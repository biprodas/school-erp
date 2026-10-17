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

### Shared-schema multi-tenancy with `org_id` + RLS (`src/tenancy/`)

- **One schema (`public`) for everything.** A school is an `Organization` (`organizations` table, `modules/platform/organizations/`). Platform entities live in `src/modules/platform/**/entities`, school-owned entities in `src/modules/tenanted/**/entities/*.entity.ts`. Both globs are loaded by the root DataSource and the tenant pool, so you don't register entities anywhere.
- **Every tenanted entity extends `OrgScopedEntity`** (`src/tenancy/org-scoped.entity.ts`), which adds `org_id` with a cascading FK to `organizations` (deleting an org deletes all its data). Per-org uniqueness must include `orgId`, e.g. `@Index('uq_classes_org_name', ['orgId', 'name'], { unique: true })`. Never put `unique: true` on a tenanted column.
- **Users are global**: one `users` table (one login across schools). Per-school state lives on `memberships` (`org_id`, `role`, `is_admin` = school admin, `status`) and `user_roles` (org-scoped). `auth_tokens` is shared; `org_id` is null for platform-issued tokens and set for school-issued ones (incl. `activation`).
- **Request flow**:
  1. `TenantMiddleware` (applied in `AppModule.configure`) resolves the org from the `x-tenant-id` header (a slug), then the subdomain, then a custom domain. Lookups are cached in memory. It sets `req.orgId` / `req.orgSlug` (`RequestWithOrg`).
  2. The request-scoped `TENANT_DATASOURCE` provider (in `TenancyModule`) takes a QueryRunner from the tenant pool, runs `set_config('app.org_id', <orgId>)`, and returns a `TenantDataSourceProxy` (which exposes `orgId`).
  3. The global `TenantCleanupInterceptor` resets the setting and releases the QueryRunner after the response.
- **Isolation is enforced twice**:
  - App level: `BaseTenantRepository` wraps `this.repo` with `scopeRepository` (`org-scoped-repository.ts`) for entities that have `orgId`, so `find*`/`count`/`save`/`create`/`update`/`delete` are pinned to the org automatically. **Query builders are not rewritten**: add `.andWhere('alias.orgId = :orgId', { orgId: this.orgId })` yourself.
  - Database level: Postgres row-level security (`rls.ts`) on every table with a NOT NULL `org_id`, policy `org_isolation` comparing against `current_setting('app.org_id')` (unset → no rows). The tenant pool connects as the restricted role `DB_APP_USERNAME`; the root connection (table owner) bypasses RLS and is used for platform code, org provisioning and migrations. Without `DB_APP_USERNAME` the pool falls back to the owner and RLS does not apply (a warning is logged).
- **Platform routes must be excluded from `TenantMiddleware`**: when you add a platform or public route (`organizations`, `memberships`, `platform/auth`, `platform/users`, `public`, `health`, `dev/mail`), add it to the `.exclude(...)` list in `src/app.module.ts`.
- **Tenanted repositories** extend `BaseTenantRepository<T>` and inject `@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy`. Never use `@InjectRepository` for tenanted entities. Because `TENANT_DATASOURCE` is request-scoped, every repository, service and controller that depends on it is request-scoped too. For transactions, use `ds.getManager()`. Global accounts are read through `AccountRepository`, org members through `MemberRepository` (`modules/tenanted/users/`).
- **Schema changes**: there are no migration files yet (`src/database/public.datasource.ts` points at `src/migrations/`).
  - In dev with `DB_SYNC=true`, the root DataSource syncs every table; then (non-production) `TenancyModule` creates the app role if missing, enables RLS, (re)creates the policies and grants the app role DML.
  - Organization creation (`OrganizationService`) runs in one transaction: insert the org, seed system roles (`RbacSeederService.seedSystemRoles(manager, orgId)`), and provision the owner (`OwnerProvisioningService.provisionOwner(manager, …)`: OWNER membership with `isAdmin`, admin role, activation token). The activation email is sent after commit.
  - Production must use migrations, including the RLS policies/grants from `rls.ts` and creating the app role (LOGIN NOSUPERUSER NOBYPASSRLS, not the table owner).

### Auth and RBAC

- **Two JWT realms**:
  - Platform (`PlatformJwtAuthGuard` / `'platform-jwt'`, plus `PlatformAdminGuard`, in `src/common/guards/`), used for super-admin and organization management. Platform tokens never carry `orgId`; `PlatformJwtStrategy` rejects tokens that do.
  - Tenant (`JwtAuthGuard` in `modules/tenanted/auth/`), used for everything inside a school. Payload `{ sub, email, orgId, isAdmin }`; `JwtStrategy` rejects tokens whose `orgId` differs from `req.orgId`. Login checks the global password, then requires an ACTIVE membership in the org.
- **Tenanted controller pattern**:
  - `@UseGuards(JwtAuthGuard, PermissionsGuard)` plus `@RequirePermissions(PERMISSIONS.X)` per handler.
  - Swagger decorators: `@ApiBearerAuth('tenant-jwt')` and `@ApiHeader({ name: 'x-tenant-id' })`.
- **Permission catalog**: permissions are code-defined in `modules/tenanted/rbac/permissions.catalog.ts`, using `resource:action` keys.
  - Roles are stored per tenant and reference these keys. System roles are seeded from `system-roles.seed.ts`.
  - Members with `isAdmin` (from their membership, carried in the JWT) bypass permission checks.
  - A new feature needs new catalog entries, plus seed updates if system roles should get them.

### Conventions

- **Path aliases** (tsconfig and Jest `moduleNameMapper`, which must be kept in sync, including `test/jest-e2e.json`): `~/common/*`, `~/config`, `~/utils/*`, `~/shared/*`, `~/tenancy/*`, `~/platform/*` → `src/modules/platform/*`, `~/tenanted/*` → `src/modules/tenanted/*`, and `src/*`.
- **Feature module layout**: `<feature>.module.ts`, `controllers/`, `services/`, `repositories/`, `entities/`, `dto/`, `enums/`. Smaller modules keep these files flat. Every module must be imported in `src/app.module.ts`. `cats`, `tasks` and `products` are sample modules.
- **Response envelope**: controllers return `{ success, statusCode, message, data }`. The frontend axios client unwraps `data`.
- **Global pipes**: `ValidationPipe` runs with `whitelist`, `forbidNonWhitelisted` and `transform`, so unknown DTO fields cause a 400. `ClassSerializerInterceptor` is global (use `@Exclude` on entity fields). Errors go through `GlobalExceptionFilter`.
- **Rate limiting**: `TenantThrottlerGuard` is a global guard that limits per tenant plus per user or IP.
- **`.http` files** (e.g. `organization.http`, `auth.http`) next to modules are manual REST-client request samples.

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
