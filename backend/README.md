# School ERP — Backend API

NestJS 11 API for the multi-tenant School ERP SaaS. It uses TypeORM with PostgreSQL. All schools (organizations) share one schema; every school-owned row carries an `org_id`, isolated by the repository layer and by Postgres row-level security.

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
| `DB_SYNC` | `true` in dev: auto-syncs the schema on boot. Never in production |
| `DB_APP_USERNAME` / `DB_APP_PASSWORD` | Restricted role the tenant pool uses so row-level security applies. Created automatically in dev; create it yourself in production (LOGIN NOSUPERUSER NOBYPASSRLS, not the table owner) |
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

npx jest src/modules/students/services/student.service.spec.ts   # single file
npx jest -t "creates a student"                                          # single test by name

npm run db:migrate     # apply pending migrations (see "Database migrations")
npm run db:seed:core   # seed platform accounts (see "Database seeding")
```

## Architecture

### Multi-tenancy (shared schema, `org_id` + RLS)

- **One `public` schema.** All feature modules sit flat under `src/modules/` (platform data: users, organizations, memberships, auth tokens; plus every school feature). Every school-owned entity extends `OrgScopedEntity`, which adds `org_id` (FK to `organizations`, `ON DELETE CASCADE`).
- **Users are global.** One login works across schools; per-school admin flag, status and roles live on `memberships` and `user_roles`.
- **Org resolution:**
  1. `TenantMiddleware` finds the organization from the `x-tenant-id` header (the slug), then the subdomain (`acme.lvh.me`), then a custom domain, and sets `req.orgId`.
  2. A request-scoped `TENANT_DATASOURCE` borrows a connection from the restricted-role pool and sets `app.org_id`.
  3. `TenantCleanupInterceptor` resets it and releases the connection after the response.
- **Isolation:** `BaseTenantRepository` pins every find/save/update/delete to the org; Postgres RLS policies on `org_id` back it up (query builders must add the `orgId` condition themselves).
- **Provisioning:** creating an organization inserts it, seeds the system roles and provisions the owner in one transaction. Deleting it cascades to all its data.

Platform and public routes (`organizations`, `memberships`, `platform/auth`, `platform/users`, `public`, `health`, `dev/mail`) are excluded from `TenantMiddleware` in `src/app.module.ts`. If you add a new route of this kind, add it to that list too.

### Auth and RBAC

- **Platform realm** (`platform-jwt`): super-admin and tenant management. `PlatformAdminGuard` requires `users.is_admin = true`.
- **Tenant realm** (`JwtAuthGuard`): everything inside a school. Handlers use `@RequirePermissions(PERMISSIONS.X)` with `PermissionsGuard`.
- **Permissions** are defined in code in `src/modules/rbac/permissions.catalog.ts`, as `resource:action` keys. Roles are stored per tenant, and system roles are seeded from `system-roles.seed.ts`. Tenant users with `isAdmin` bypass permission checks.

### Conventions

- **Response envelope:** `{ success, statusCode, message, data }`.
- **Validation:** the global `ValidationPipe` uses `whitelist`, `forbidNonWhitelisted` and `transform`, so unknown DTO fields return 400.
- **Serialization and errors:** `ClassSerializerInterceptor` is global, so use `@Exclude` to hide entity fields. Errors go through `GlobalExceptionFilter`.
- **Path aliases:** `~/common`, `~/config`, `~/utils`, `~/shared`, `~/tenancy`, `~/modules`. Keep `tsconfig.json`, Jest `moduleNameMapper` and `test/jest-e2e.json` in sync.
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

The quickest way in dev is `npm run db:seed:core`, which creates ready-to-use platform accounts (see [Database seeding](#database-seeding)). To create one by hand instead:

1. Register with `POST /api/platform/auth/register`.
2. Verify the email from the link in Mailpit (http://localhost:8025).
3. Promote the account to admin, for example in pgAdmin:
   ```sql
   UPDATE public.users SET is_admin = true WHERE email = 'you@example.com';
   ```
4. Log in with `POST /api/platform/auth/login` and create an organization through `/api/organizations`.
5. Tenant APIs are then reachable with an `x-tenant-id: <slug>` header, or through `http://<slug>.lvh.me:3900/api`.

## Database migrations

Migrations are TypeORM classes in `src/migrations/`, run through the CLI data source `src/database/public.datasource.ts`. That data source:

- **Env:** loads the same env files as the app, `.env` and then `.env.${NODE_ENV}`. Variables already set in the shell win, so `DB_NAME=other npm run db:migrate` works.
- **Role:** connects as the owner (`DB_USERNAME`), so it bypasses RLS.
- **Tracking:** records applied migrations in the `migrations` table.

```bash
npm run db:status                               # list migrations, [X] = applied
npm run db:generate -- src/migrations/AddFooBar # diff entities against the DB and write a migration
npm run db:create -- src/migrations/BackfillFoo # empty migration for hand-written SQL / data changes
npm run db:migrate                              # apply pending migrations
npm run db:rollback                             # undo the last applied migration (repeat to go further back)
```

### Workflow for a schema change

1. Point your DB at the latest migrations, not at sync: set `DB_SYNC=false` in `.env.development`, then run `npm run db:migrate`. With `DB_SYNC=true` the app has already applied your entity changes, so `db:generate` finds nothing to diff.
2. Change the entity.
3. Run `npm run db:generate -- src/migrations/<PascalCaseName>`, then read the generated SQL. TypeORM sometimes drops and recreates a column where you meant a rename. Fix that by hand to keep the data.
4. Run `npm run db:migrate`, check the app, and confirm `npm run db:rollback` works too.
5. Commit the migration together with the entity change. Never edit a migration that has already run in a shared environment. Add a new one instead.

### New tenanted tables need RLS in the migration

`db:generate` only creates tables and columns. When you add an entity that extends `OrgScopedEntity` (a NOT NULL `org_id`), the same migration must also enable the `org_isolation` policy on it. In production nothing else will add the policy:

```ts
// up()
await queryRunner.query(`ALTER TABLE public."fee_invoices" ENABLE ROW LEVEL SECURITY`);
await queryRunner.query(
  `CREATE POLICY org_isolation ON public."fee_invoices"
     USING (org_id = NULLIF(current_setting('app.org_id', true), '')::uuid)
     WITH CHECK (org_id = NULLIF(current_setting('app.org_id', true), '')::uuid)`,
);

// down()
await queryRunner.query(`DROP POLICY IF EXISTS org_isolation ON public."fee_invoices"`);
await queryRunner.query(`ALTER TABLE public."fee_invoices" DISABLE ROW LEVEL SECURITY`);
```

In dev, `TenancyModule` also re-applies RLS and the app-role grants on every boot (`src/tenancy/rls.ts`), so a missing policy only shows up in production. Keep the migration as the source of truth.

### Production

```bash
npm run build
NODE_ENV=production npm run db:migrate:prod   # runs dist/migrations with dist/database/public.datasource.js
```

- Run migrations before starting the new app version. Never set `DB_SYNC=true` in production.
- Create the restricted app role (`DB_APP_USERNAME`) yourself, with LOGIN NOSUPERUSER NOBYPASSRLS, not as the table owner. Then grant it DML on `public`, including tables created later:
  ```sql
  GRANT USAGE ON SCHEMA public TO school_erp_app;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO school_erp_app;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO school_erp_app;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO school_erp_app;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO school_erp_app;
  ```

### A dev DB that was built with `DB_SYNC=true`

A synced DB already has the tables, so the initial migration fails on it with "relation already exists". Pick one fix:

- **Reset (simplest):** drop and recreate the database (e.g. `school_erp`) in pgAdmin, then run `npm run db:migrate` and the seeders.
- **Keep the data:** mark the initial migration as applied, then run `npm run db:migrate`. The RLS migration is idempotent, so it runs fine on a synced DB. First run `npm run db:status` once so TypeORM creates the `migrations` table, then:
  ```sql
  INSERT INTO public.migrations ("timestamp", name) VALUES (1792231987093, 'InitialSchema1792231987093');
  ```
  Only do this if the synced schema matches the entities. `npm run db:generate -- src/migrations/Check` should then report "No changes".

## Database seeding

Seeders live in `src/database/seeds/` and run through `src/database/seeds/run-seed.ts`:

- **Connection:** they use the CLI data source (owner role, same env files) against the current DB, which must already be migrated or synced.
- **Production:** they refuse to run when `NODE_ENV=production`, because they contain dev credentials.

```bash
npm run db:seed:core    # platform user accounts
```

`core` seeds the platform accounts from `src/database/seeds/data/users.data.ts`:

| Email | Username | Platform role | Platform admin | Password |
|-------|----------|---------------|----------------|----------|
| admin@biprodas.dev | sadmin | super_admin | yes | `sadmin@123` |
| biprodas@biprodas.dev | biprodas | admin | yes | `biprodas@123` |
| support@biprodas.dev | support | support | no | `support@123` |
| dev@biprodas.dev | dev | developer | no | `dev@123` |
| liyana@biprodas.dev | liyana | user | no | `liyana@123` |
| demo@pitchpool.io | demo | user | no | `demo@123` |

- **Admin flag:** `users.is_admin` (what `PlatformAdminGuard` checks) is set only for `super_admin` and `admin`.
- **Re-runs:** the seeder is idempotent and matches users by email. New users are created ACTIVE and email-verified. Existing users get username, name, role and admin flag re-synced but keep their current password.
- **Transactions:** each seeder runs in one transaction, so a failure leaves nothing half-written.

### Adding a seeder

1. Put the data in `src/database/seeds/data/<name>.data.ts` and the logic in `src/database/seeds/<name>.seeder.ts`. Export `async function seedX(ds: DataSource)`, and make it idempotent by looking rows up by a natural key before inserting.
2. Register it in the `SEEDERS` map in `run-seed.ts`.
3. Add `"db:seed:<name>": "ts-node src/database/seeds/run-seed.ts <name>"` to `package.json`.
4. Tenanted data must set `orgId` explicitly, because the owner connection bypasses RLS and the tenant repository scoping. Reuse the existing provisioning code where it fits, for example `RbacSeederService.seedSystemRoles(manager, orgId)` for an org's system roles.

### Fresh local database, end to end

```bash
docker compose up -d        # from the repo root
cd backend
npm run db:migrate          # with DB_SYNC=false
npm run db:seed:core
npm run start:dev
```

Then log in on the platform with `admin@biprodas.dev` / `sadmin@123` (`POST /api/platform/auth/login`).
