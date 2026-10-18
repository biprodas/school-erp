# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Monorepo for a multi-tenant School ERP SaaS. `backend/` is a NestJS 11 API (TypeORM + PostgreSQL), `frontend/` is a Next.js 16 App Router app (React 19, Tailwind v4, shadcn/radix UI, TanStack Query, NextAuth v5). The two are separate npm projects with no root workspace, so run commands from inside each directory. `doc/` holds product and design docs: `prd.md` (the product spec and source of truth), DB designs (`db-schema.md`, `academic-db.md`, `student-db.md`) and an example frontend menu.

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
npx jest src/modules/students/services/student.service.spec.ts   # single file
npx jest -t "creates a student"        # single test by name
npm run test:e2e                       # test/*.e2e-spec.ts; needs a live Postgres. Uses its own <DB_NAME>_e2e database (created on first run) and a restricted app role so RLS applies (test/e2e-env.ts)
```

Frontend (`cd frontend`, http://localhost:3000):

```bash
npm run dev
npm run build
npm run lint
```

The frontend has no test runner.

Local env: the backend reads `.env` and then `.env.${NODE_ENV}` (`.env.development` by default), validated by Joi in `src/config/env.validation.ts`. Mail defaults to Mailpit on `localhost:1025`. `CORS_ORIGIN` is required in production and accepts `https://*.example.com` entries for tenant subdomains (`src/config/cors.ts`). Tenant subdomains use `lvh.me` in dev (e.g. `http://acme.lvh.me:3000`). See `backend/.env.example` and `frontend/.env.example`.

## Backend architecture

### Shared-schema multi-tenancy with `org_id` + RLS (`src/tenancy/`)

- **One schema (`public`) for everything.** A school is an `Organization` (`organizations` table, `modules/organizations/`). All feature modules sit flat under `src/modules/` (no platform/tenanted split); what makes an entity school-owned is extending `OrgScopedEntity`, not its folder. The glob `src/modules/**/entities/*.entity.ts` is loaded by the root DataSource and the tenant pool, so you don't register entities anywhere.
- **Every tenanted entity extends `OrgScopedEntity`** (`src/tenancy/org-scoped.entity.ts`), which adds `org_id` with a cascading FK to `organizations` (deleting an org deletes all its data). Per-org uniqueness must include `orgId`, e.g. `@Index('uq_classes_org_name', ['orgId', 'name'], { unique: true })`. Never put `unique: true` on a tenanted column.
- **Users are global**: one `users` table (one login across schools). Per-school state lives on `memberships` (`org_id`, `role`, `is_admin` = school admin, `status`) and `user_roles` (org-scoped). `auth_tokens` is shared; `org_id` is null for platform-issued tokens and set for school-issued ones (incl. `activation`).
- **Request flow**:
  1. `TenantMiddleware` (applied in `AppModule.configure`) resolves the org from the `x-tenant-id` header (a slug), then the subdomain, then a custom domain (`organization_domains`, only `verified`/`active` rows). Lookups are cached in memory. It sets `req.orgId` / `req.orgSlug` (`RequestWithOrg`).
  2. The request-scoped `TENANT_DATASOURCE` provider (in `TenancyModule`) takes a QueryRunner from the tenant pool, runs `set_config('app.org_id', <orgId>)`, and returns a `TenantDataSourceProxy` (which exposes `orgId`).
  3. The global `TenantCleanupInterceptor` resets the setting and releases the QueryRunner after the response.
- **Isolation is enforced twice**:
  - App level: `BaseTenantRepository` wraps `this.repo` with `scopeRepository` (`org-scoped-repository.ts`) for entities that have `orgId`, so `find*`/`count`/aggregates/`save`/`create`/`update`/`delete`/`increment` are pinned to the org automatically, `remove` only accepts entities of the org, and unscoped escape hatches (`upsert`, `preload`, `query`, `manager`, …) throw. **Query builders are not rewritten**: add `.andWhere('alias.orgId = :orgId', { orgId: this.orgId })` yourself.
  - Database level: Postgres row-level security (`rls.ts`) on every table with a NOT NULL `org_id`, policy `org_isolation` comparing against `current_setting('app.org_id')` (unset → no rows). The tenant pool connects as the restricted role `DB_APP_USERNAME`; the root connection (table owner) bypasses RLS and is used for platform code, org provisioning and migrations. Without `DB_APP_USERNAME` the pool falls back to the owner and RLS does not apply (a warning is logged).
- **App role grants**: the restricted role gets DML only on the org-scoped tables plus `users` and `auth_tokens` (`rls.ts` in dev, the `AppRoleGrants` migration in production). A migration that adds a tenanted table must enable RLS on it and grant the app role.
- **Platform routes must be excluded from `TenantMiddleware`**: when you add a platform or public route (`organizations`, `memberships`, `platform/auth`, `platform/users`, `public`, `health`, `dev/mail`), add it to the `.exclude(...)` list in `src/app.module.ts`.
- **Tenanted repositories** extend `BaseTenantRepository<T>` and inject `@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy`. Never use `@InjectRepository` for org-scoped entities. Because `TENANT_DATASOURCE` is request-scoped, every repository, service and controller that depends on it is request-scoped too. For multi-step writes, inject `TENANT_DATASOURCE` into the service and wrap them in `ds.runInTransaction(async () => …)`: all tenant repositories of the request share its QueryRunner, so they join the transaction automatically (nested calls become savepoints). In unit tests pass `fakeTenantDataSource()` (`tenancy/tenant-datasource.testing.ts`). Global accounts are read through `AccountRepository`, org members through `MemberRepository` (`modules/users/repositories/`).
- **Schema changes**: migrations live in `src/migrations/` (`npm run db:generate` / `db:migrate`, via `src/database/public.datasource.ts`). Every schema change needs one; don't edit migrations that have already run, add a new one (see `DropSampleModules`).
  - In dev with `DB_SYNC=true`, the root DataSource syncs every table; then (non-production) `TenancyModule` creates the app role if missing, enables RLS, (re)creates the policies and grants the app role DML.
  - Organization creation (`OrganizationService`) runs in one transaction: insert the org, seed system roles (`RbacSeederService.seedSystemRoles(manager, orgId)`), and provision the owner (`OwnerProvisioningService.provisionOwner(manager, …)`: OWNER membership with `isAdmin`, admin role, activation token). The activation email is sent after commit.
  - Production must use migrations, including the RLS policies/grants from `rls.ts` and creating the app role (LOGIN NOSUPERUSER NOBYPASSRLS, not the table owner).

### Auth and RBAC

- **Two JWT realms**:
  - Platform (`PlatformJwtAuthGuard` / `'platform-jwt'`, plus `PlatformAdminGuard`, in `src/common/guards/`), used for super-admin and organization management. Platform tokens never carry `orgId`; `PlatformJwtStrategy` rejects tokens that do.
  - Tenant (`JwtAuthGuard` in `modules/auth/guards/`), used for everything inside a school. Payload `{ sub, email, orgId, isAdmin }`; `JwtStrategy` rejects tokens whose `orgId` differs from `req.orgId`. Login checks the global password, then requires an ACTIVE membership in the org.
- **Tenanted controller pattern**:
  - `@UseGuards(JwtAuthGuard, PermissionsGuard)` plus `@RequirePermissions(PERMISSIONS.X)` per handler.
  - Swagger decorators: `@ApiBearerAuth('tenant-jwt')` and `@ApiHeader({ name: 'x-tenant-id' })`.
- **Permission catalog**: permissions are code-defined in `modules/rbac/permissions.catalog.ts`, using `resource:action` keys.
  - Roles are stored per tenant and reference these keys. System roles are seeded from `system-roles.seed.ts`.
  - Members with `isAdmin` (from their membership, carried in the JWT) bypass permission checks.
  - A new feature needs new catalog entries, plus seed updates if system roles should get them.

### Conventions

- **Imports**: relative paths inside a module; `~/modules/…`, `~/common/…`, `~/tenancy/…`, `~/shared/…`, `~/utils/…` and `~/config` across areas (no `src/…` imports in `src/`). `req.user` is typed as `AuthUser` (`common/auth/auth-user.ts`), which both JWT strategies return.
- **Path aliases** (tsconfig and Jest `moduleNameMapper`, which must be kept in sync, including `test/jest-e2e.json`): `~/common/*`, `~/config`, `~/utils/*`, `~/shared/*`, `~/tenancy/*`, `~/modules/*` → `src/modules/*`, and `src/*`.
- **Feature module layout**: `<feature>.module.ts`, `controllers/`, `services/`, `repositories/`, `entities/`, `dto/`, `enums/` (rbac also has `guards/` and `decorators/`). A module with a single controller, service and repository keeps those three flat; as soon as it has more than one of any, it uses the subfolders. `auth/` and `users/` each hold both realms in one module: platform pieces are prefixed `platform-`/`Platform*` (e.g. `PlatformAuthController` on `/platform/auth`, `PlatformUserController` on `/platform/users`), tenant pieces are unprefixed or `org-`/`Org*` (`AuthController` on `/auth`, `OrgUserController`/`OrgUserService` on `/users`). Every module must be imported in `src/app.module.ts`.
- **Module boundaries**: modules talk to each other through exported services (e.g. `AcademicYearService.findById` to check a referenced id, `RoleService.findSystemRole`), never through another module's repository; modules export services, not repositories. The one exception is `UserModule` exporting `AccountRepository`/`MemberRepository` for `AuthModule`'s password flows. `RbacModule` knows nothing about users: the `/users/:userId/roles` endpoints live in `UserModule` (`OrgUserService.assignRole` checks membership), and `OwnerProvisioningService` is provided by `AuthModule`. `src/app.module.spec.ts` boots the whole AppModule with stubbed DataSources, so a missing import/export fails `npm test`.
- **Response envelope**: handlers return plain data; the global `ResponseEnvelopeInterceptor` (`common/interceptors/`, registered in `src/app.setup.ts`) wraps it as `{ success, statusCode, message, data }`, with the message from `@ResponseMessage('…')` and `@RawResponse()` to opt out (health, HTML). Errors come out of `GlobalExceptionFilter` as `{ success: false, statusCode, message, … }`. The frontend axios client unwraps `data`.
- **Pagination**: list endpoints for school data take `?page=&limit=` (filter DTOs extend `PaginationQueryDto`, default 20, max 100); repositories return `this.findPage(options, page)` and the envelope gains `meta: { page, limit, total, totalPages }` next to `data`, which stays a plain array.
- **Global pipes**: `ValidationPipe` runs with `whitelist`, `forbidNonWhitelisted` and `transform`, so unknown DTO fields cause a 400. `ClassSerializerInterceptor` is global (use `@Exclude` on entity fields). Errors go through `GlobalExceptionFilter`.
- **Logging**: `nestjs-pino` (`shared/logging/`) replaces Nest's logger, so use `new Logger(Context)` from `@nestjs/common` as usual. Lines are JSON (pretty in development), carry the request's `reqId` (`x-request-id`, set by `RequestIdMiddleware`) and, inside handlers, `orgId`/`userId`; each request ends with one `request completed` line. Never log secrets; `authorization`/`cookie` headers are redacted. `LOG_LEVEL` sets the level (tests default to `silent`).
- **Deleting**: entities with a `@DeleteDateColumn` (students, employees, guardians, stakeholders, academic years, student documents and notes) are soft-deleted by `BaseTenantRepository.deleteById`/`remove`, which keeps the history the PRD requires; their unique business keys are partial indexes (`WHERE "deleted_at" IS NULL`). Other entities are hard-deleted.
- **Constraint races**: "only one" rules (current academic year, primary class teacher, primary guardian) are partial unique indexes as well as service checks; a Postgres unique or FK violation becomes a 409 in `GlobalExceptionFilter`.
- **Rate limiting**: `TenantThrottlerGuard` is a global guard that limits per tenant plus per user or IP.
- **Background jobs**: `@nestjs/schedule` (v6; v12 is ESM-only and doesn't load under Jest) is registered in `AppModule` and disabled when `NODE_ENV=test`. Jobs that span schools (e.g. `DomainCheckScheduler`) read through the root connection with `@InjectRepository`; expose a `runOnce()` so tests can drive them.
- **`.http` files** (e.g. `organization.http`, `auth.http`) next to modules are manual REST-client request samples.

## Frontend architecture

- **Path alias**: `~/*` → `src/*`.
- **Tenant resolution** (`src/lib/tenant.ts`):
  - A subdomain of `NEXT_PUBLIC_ROOT_DOMAIN` resolves to a tenant slug.
  - Custom domains resolve through a backend public endpoint.
  - The apex or `localhost` is the platform host, which shows the platform/super-admin UI under `app/platform/`.
- **Auth** (`src/auth.ts`, `src/auth.config.ts`, `src/proxy.ts`): NextAuth v5 with three Credentials providers: `tenant-credentials`, `platform-credentials` and `handoff`.
  - Session cookies are host-only (Auth.js defaults): each school host, subdomain or custom domain, has its own session. Moving between hosts uses a one-time handoff code: `POST /platform/auth/handoff` issues it, and `app/auth/handoff/route.ts` on the school host redeems it (`POST /auth/handoff`) through the `handoff` Credentials provider. See `doc/domains-and-routing.md`.
  - Don't set `AUTH_URL`, because it breaks multi-subdomain login.
- **API clients**: `src/lib/api/client.ts` (browser) and `src/lib/api/server.ts` (RSC and server actions). Both are built on `createApiClient` in `lib/api/axios.ts`, which injects the bearer token and the `x-tenant-id` header from the session or host, unwraps the envelope, and normalizes errors to `ApiError`.
- **API modules**: endpoint and query hooks live in `src/apis/{platform,tenanted}/<resource>/`. Query keys are in `lib/api/query-keys.ts`.
- **Routes**:
  - `app/(dashboard)`: tenant staff dashboard. Its sidebar is defined in `(dashboard)/_components/sidebar-nav.tsx`. Sidebar items can be role-gated (`lib/sidebar-nav.ts`).
  - `app/student`: student portal.
  - `app/platform`: platform admin.
  - `app/(auth)` and `app/(main)`: auth and marketing pages.
- **`src/features/<domain>/`**: feature UI components. Many are still placeholders.
- **UI and build**: shadcn components live in `src/components/ui` (`components.json`), and antd is also available. The React Compiler is enabled (`reactCompiler: true`).
