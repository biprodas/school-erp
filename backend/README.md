# School ERP — Backend API

NestJS 11 API for the multi-tenant School ERP SaaS. It uses TypeORM with PostgreSQL and gives each school (tenant) its own Postgres schema.

- API: `http://localhost:3900/api`
- Swagger: `http://localhost:3900/api/docs`
- Health: `http://localhost:3900/api/health`

## Quick start

```bash
# 1. Start local infrastructure (from the repo root)
docker compose up -d          # Postgres :5433, pgAdmin :5050, Redis :6379, RedisInsight :5540, Mailpit :1025/:8025

# 2. Configure env (from backend/)
cp -n .env.example .env.development   # skipped if it exists; then set JWT_SECRET (min 32 chars) and DB_SYNC=true for first run

# 3. Install and run
npm install
npm run start:dev
```

See the root [README](../README.md#local-infrastructure) for the service URLs and credentials.

## Environment

The app loads `.env` first, then `.env.${NODE_ENV}` (`.env.development` by default). Joi validates every variable at boot in `src/config/env.validation.ts`, and the app won't start if validation fails. `.env.example` lists every variable. The ones that matter most:

| Variable | Notes |
|----------|-------|
| `DB_HOST` / `DB_PORT` / `DB_NAME` | `localhost` / `5433` / `school_erp` for the docker Postgres |
| `DB_SYNC` | `true` in dev: auto-syncs the public schema and re-syncs every tenant schema on boot. Never in production |
| `JWT_SECRET` | Required, at least 32 characters |
| `MAIL_HOST` / `MAIL_PORT` | Mailpit at `localhost:1025`. Read sent mail at http://localhost:8025 |
| `APP_URL` / `ROOT_DOMAIN` | Used to build email links (`{slug}.{ROOT_DOMAIN}`). Dev uses `lvh.me` |
| `RATE_LIMIT_*` | Global throttler, applied per tenant plus per user or IP |

## Scripts

```bash
npm run start:dev      # watch mode
npm run start:debug    # watch + inspector
npm run build          # compile to dist/
npm run start:prod     # node dist/main
npm run lint           # eslint --fix
npm run format         # prettier

npm test               # unit tests (src/**/*.spec.ts)
npm run test:cov       # with coverage
npm run test:e2e       # test/*.e2e-spec.ts. Loads .env.development and needs a running Postgres

npx jest src/modules/tenanted/students/services/student.service.spec.ts   # single file
npx jest -t "creates a student"                                          # single test by name
```

## Architecture

### Multi-tenancy (schema per tenant)

- **Public schema** holds platform data: platform users, tenants and memberships (`src/modules/platform/`). It uses the standard `@nestjs/typeorm` connection.
- **Tenant schemas** hold school data, one Postgres schema per tenant (`src/modules/tenanted/`).
- **Tenant resolution:**
  1. `TenantMiddleware` finds the tenant from the `x-tenant-id` header (the tenant slug), then the subdomain (`acme.lvh.me`), then a custom domain.
  2. A request-scoped `TENANT_DATASOURCE` sets `search_path` to the tenant's schema.
  3. `TenantCleanupInterceptor` releases the connection after the response.
- **Provisioning:** creating a tenant creates its schema, syncs it, seeds the system roles and creates the owner membership. If any step fails, the earlier steps are rolled back.

Platform and public routes (`tenants`, `memberships`, `platform/auth`, `platform/users`, `public`, `health`, `dev/mail`) are excluded from `TenantMiddleware` in `src/app.module.ts`. If you add a new route of this kind, add it to that list too.

### Auth and RBAC

- **Platform realm** (`platform-jwt`): super-admin and tenant management. `PlatformAdminGuard` requires `users.is_admin = true`.
- **Tenant realm** (`JwtAuthGuard`): everything inside a school. Handlers use `@RequirePermissions(PERMISSIONS.X)` with `PermissionsGuard`.
- **Permissions** are defined in code in `src/modules/tenanted/rbac/permissions.catalog.ts`, as `resource:action` keys. Roles are stored per tenant, and system roles are seeded from `system-roles.seed.ts`. Tenant users with `isAdmin` bypass permission checks.

### Conventions

- **Response envelope:** `{ success, statusCode, message, data }`.
- **Validation:** the global `ValidationPipe` uses `whitelist`, `forbidNonWhitelisted` and `transform`, so unknown DTO fields return 400.
- **Serialization and errors:** `ClassSerializerInterceptor` is global, so use `@Exclude` to hide entity fields. Errors go through `GlobalExceptionFilter`.
- **Path aliases:** `~/common`, `~/config`, `~/utils`, `~/shared`, `~/tenancy`, `~/platform`, `~/tenanted`. Keep `tsconfig.json`, Jest `moduleNameMapper` and `test/jest-e2e.json` in sync.
- **`.http` files** next to modules are sample requests for a REST client.

For the full folder map, see [doc/backend-structure.md](../doc/backend-structure.md).

## Modules

| Area | Modules |
|------|---------|
| Platform | `auth`, `users`, `tenants`, `memberships` |
| Tenant core | `auth`, `users`, `rbac` |
| People | `students`, `guardians`, `employees`, `departments`, `designations`, `stakeholders` |
| Academics | `academic-years`, `classes`, `sections`, `subjects`, `subject-groups`, `class-curriculum`, `enrollments`, `teaching`, `timetable`, `promotions` |
| Shared | `health`, `mail` (Handlebars templates + dev-only `dev/mail` trigger endpoints) |
| Samples | `cats`, `tasks`, `products` |

## First run: creating a platform admin

1. Register with `POST /api/platform/auth/register`.
2. Verify the email from the link in Mailpit (http://localhost:8025).
3. Promote the account to admin, for example in pgAdmin:
   ```sql
   UPDATE public.users SET is_admin = true WHERE email = 'you@example.com';
   ```
4. Log in with `POST /api/platform/auth/login` and create a tenant through `/api/tenants`.
5. Tenant APIs are then reachable with an `x-tenant-id: <slug>` header, or through `http://<slug>.lvh.me:3900/api`.

## Database migrations

There are no migration files yet. Dev relies on `DB_SYNC=true`. Production must use migrations: use `src/database/tenant-migration.datasource.ts` with `typeorm migration:generate` for tenant schemas, and `TenantMigrationService` to apply them across tenants.
