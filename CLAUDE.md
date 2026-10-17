# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Monorepo for a multi-tenant School ERP SaaS. `backend/` is a NestJS 11 API (TypeORM + PostgreSQL), `frontend/` is a Next.js 16 App Router app (React 19, Tailwind v4, shadcn/radix UI, TanStack Query, NextAuth v5). The two are separate npm projects with no root workspace, so run commands from inside each directory. `doc/` holds product and design docs (menu IA, features, DB designs, RBAC/platform-admin user stories). `doc/backend-structure.md` maps the backend folder layout.

`frontend/CLAUDE.md` → `frontend/AGENTS.md` warns that this Next.js version has breaking changes compared with your training data. Read the relevant guide in `frontend/node_modules/next/dist/docs/` before writing frontend code. For example, middleware now lives in `src/proxy.ts`, not `middleware.ts`.

## Commands

Local infrastructure (repo root): `docker compose up -d` starts Postgres (host port 5433), pgAdmin (:5050), Redis (:6379), RedisInsight (:5540) and Mailpit (SMTP :1025, UI :8025). Overrides go in a root `.env` (see `.env.docker.example`).

Backend (`cd backend`, API on `PORT=3900` with global prefix `/api`, Swagger at `/api/docs`):

```bash
npm run start:dev                      # watch mode
npm run build
npm run lint                           # eslint --fix
npm run format                         # prettier
npm test                               # unit tests (*.spec.ts under src/)
npx jest src/modules/tenanted/students/services/student.service.spec.ts   # single file
npx jest -t "creates a student"        # single test by name
npm run test:e2e                       # test/*.e2e-spec.ts; loads .env.development, needs a live Postgres
```

Frontend (`cd frontend`, http://localhost:3000):

```bash
npm run dev
npm run build
npm run lint
```

The frontend has no test runner.

Local env: the backend reads `.env` and then `.env.${NODE_ENV}` (`.env.development` by default), validated by Joi in `src/config/env.validation.ts`. Mail defaults to Mailpit on `localhost:1025`. Tenant subdomains use `lvh.me` in dev (e.g. `http://acme.lvh.me:3000`). See `backend/.env.example` and `frontend/.env.example`.

## Backend architecture

### Schema-per-tenant multi-tenancy (`src/tenancy/`)

- **Public schema**: platform-level data (tenants, platform users, memberships). These entities live in `src/modules/platform/**/entities` and are accessed through the standard `@nestjs/typeorm` root connection (`TypeOrmModule.forFeature`, `@InjectRepository`).
- **Tenant schemas**: one Postgres schema per tenant (`tenant.schemaName`). Entities live in `src/modules/tenanted/**/entities/*.entity.ts`, and the entity glob picks them up automatically, so you don't register them anywhere.
- **Request flow**:
  1. `TenantMiddleware` (applied in `AppModule.configure`) resolves the tenant from the `x-tenant-id` header (a slug), then the subdomain, then a custom domain. Lookups are cached in memory.
  2. The middleware sets `req.tenantSchema`.
  3. The request-scoped `TENANT_DATASOURCE` provider (in `TenancyModule`) takes a QueryRunner from a shared pool, runs `SET search_path TO "<schema>", public`, and returns a `TenantDataSourceProxy`.
  4. The global `TenantCleanupInterceptor` releases the QueryRunner after the response.
- **Platform routes must be excluded from `TenantMiddleware`**: when you add a platform or public route (`tenants`, `memberships`, `platform/auth`, `platform/users`, `public`, `health`, `dev/mail`), add it to the `.exclude(...)` list in `src/app.module.ts`.
- **Tenanted repositories** extend `BaseTenantRepository<T>` and inject `@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy`. Never use `@InjectRepository` for tenanted entities. Because `TENANT_DATASOURCE` is request-scoped, every repository, service and controller that depends on it is request-scoped too. For transactions, use `ds.getManager()`.
- **Schema changes**: there are no migration files yet (`src/migrations/{public,tenant}/` is referenced but doesn't exist).
  - In dev with `DB_SYNC=true`, the public schema auto-syncs, and on boot `TenantConnectionService` re-synchronizes every tenant schema listed in `public.tenants`.
  - Tenant creation (`TenantService`) creates the schema, syncs it, seeds system roles (`RbacSeederService`) and creates the owner membership, with a compensating rollback on failure.
  - Production must use migrations: `TenantMigrationService` and `src/database/tenant-migration.datasource.ts` for `typeorm migration:generate`.

### Auth and RBAC

- **Two JWT realms**:
  - Platform (`PlatformJwtAuthGuard` / `'platform-jwt'`, plus `PlatformAdminGuard`, in `src/common/guards/`), used for super-admin and tenant management.
  - Tenant (`JwtAuthGuard` in `modules/tenanted/auth/`), used for everything inside a school.
- **Tenanted controller pattern**:
  - `@UseGuards(JwtAuthGuard, PermissionsGuard)` plus `@RequirePermissions(PERMISSIONS.X)` per handler.
  - Swagger decorators: `@ApiBearerAuth('tenant-jwt')` and `@ApiHeader({ name: 'x-tenant-id' })`.
- **Permission catalog**: permissions are code-defined in `modules/tenanted/rbac/permissions.catalog.ts`, using `resource:action` keys.
  - Roles are stored per tenant and reference these keys. System roles are seeded from `system-roles.seed.ts`.
  - Users with `isAdmin` bypass permission checks.
  - A new feature needs new catalog entries, plus seed updates if system roles should get them.

### Conventions

- **Path aliases** (tsconfig and Jest `moduleNameMapper`, which must be kept in sync, including `test/jest-e2e.json`): `~/common/*`, `~/config`, `~/utils/*`, `~/shared/*`, `~/tenancy/*`, `~/platform/*` → `src/modules/platform/*`, `~/tenanted/*` → `src/modules/tenanted/*`, and `src/*`.
- **Feature module layout**: `<feature>.module.ts`, `controllers/`, `services/`, `repositories/`, `entities/`, `dto/`, `enums/`. Smaller modules keep these files flat. Every module must be imported in `src/app.module.ts`. `cats`, `tasks` and `products` are sample modules.
- **Response envelope**: controllers return `{ success, statusCode, message, data }`. The frontend axios client unwraps `data`.
- **Global pipes**: `ValidationPipe` runs with `whitelist`, `forbidNonWhitelisted` and `transform`, so unknown DTO fields cause a 400. `ClassSerializerInterceptor` is global (use `@Exclude` on entity fields). Errors go through `GlobalExceptionFilter`.
- **Rate limiting**: `TenantThrottlerGuard` is a global guard that limits per tenant plus per user or IP.
- **`.http` files** (e.g. `tenant.http`, `auth.http`) next to modules are manual REST-client request samples.

## Frontend architecture

- **Path alias**: `~/*` → `src/*`.
- **Tenant resolution** (`src/lib/tenant.ts`):
  - A subdomain of `NEXT_PUBLIC_ROOT_DOMAIN` resolves to a tenant slug.
  - Custom domains resolve through a backend public endpoint.
  - The apex or `localhost` is the platform host, which shows the platform/super-admin UI under `app/platform/`.
- **Auth** (`src/auth.ts`, `src/auth.config.ts`, `src/proxy.ts`): NextAuth v5 with two Credentials providers, tenant and `platform-credentials`.
  - The session cookie is shared across subdomains via `AUTH_COOKIE_DOMAIN`.
  - Don't set `AUTH_URL`, because it breaks multi-subdomain login.
- **API clients**: `src/lib/api/client.ts` (browser) and `src/lib/api/server.ts` (RSC and server actions). Both are built on `createApiClient` in `lib/api/axios.ts`, which injects the bearer token and the `x-tenant-id` header from the session or host, unwraps the envelope, and normalizes errors to `ApiError`.
- **API modules**: endpoint and query hooks live in `src/apis/{platform,tenanted}/<resource>/`. Query keys are in `lib/api/query-keys.ts`.
- **Routes**:
  - `app/(dashboard)`: tenant staff dashboard. Its sidebar is defined in `(dashboard)/_components/sidebar-nav.tsx` and documented in `doc/menu-structure.md`, so keep the two in sync. Sidebar items can be role-gated (`lib/sidebar-nav.ts`).
  - `app/student`: student portal.
  - `app/platform`: platform admin.
  - `app/(auth)` and `app/(main)`: auth and marketing pages.
- **`src/features/<domain>/`**: feature UI components. Many are still placeholders.
- **UI and build**: shadcn components live in `src/components/ui` (`components.json`), and antd is also available. The React Compiler is enabled (`reactCompiler: true`).
