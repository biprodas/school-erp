# School ERP — Backend API

NestJS 11 API for the multi-tenant School ERP SaaS. It uses TypeORM with PostgreSQL. All schools (organizations) share one schema; every school-owned row carries an `org_id`, isolated by the repository layer and by Postgres row-level security.

- API: `http://localhost:3900/api`
- Swagger: `http://localhost:3900/api/docs`
- Health: `http://localhost:3900/api/health`

## Quick start

```bash
# 1. Start local infrastructure (from the repo root)
docker compose up -d          # Postgres :5433, pgAdmin :5050, Redis :6379, RedisInsight :5540, MinIO :9000/:9001, Mailpit :1025/:8025

# 2. Configure env (from backend/)
cp -n .env.example .env.local   # skipped if it exists (.env.development works too); then set JWT_SECRET (min 32 chars)

# 3. Install, build the database and run
npm install
npm run db:migrate            # after creating the app role, see "Database bootstrap"
npm run db:seed:core
npm run start:dev
```

To skip migrations on a throwaway DB, set `DB_SYNC=true` and go straight to `npm run start:dev`. [Database bootstrap](#database-bootstrap) explains both paths.

See the root [README](../README.md#local-infrastructure) for the service URLs and credentials.

## Environment

The app loads `.env.local` (this machine's settings, skipped under `NODE_ENV=test`), then `.env`, then `.env.${NODE_ENV}` (`.env.development` by default); a variable in an earlier file wins, and the shell wins over all of them (`src/config/env-files.ts`). Joi validates every variable at boot in `src/config/env.validation.ts`, and the app won't start if validation fails. `.env.example` lists every variable. The ones that matter most:

| Variable | Notes |
|----------|-------|
| `DB_HOST` / `DB_PORT` / `DB_NAME` | `localhost` / `5433` / `school_erp` for the docker Postgres |
| `DB_SYNC` | `true` in dev: auto-syncs the schema on boot. Never in production |
| `DB_APP_USERNAME` / `DB_APP_PASSWORD` | Restricted role the tenant pool uses so row-level security applies. Created when the app boots outside production, but `db:migrate` needs it first (see [Database bootstrap](#database-bootstrap)); create it yourself in production (LOGIN NOSUPERUSER NOBYPASSRLS, not the table owner) |
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
npm run lint:check     # eslint without fixing, no warnings allowed (CI)
npm run format:check   # prettier --check (CI)
npm run typecheck      # tsc --noEmit over src and test (CI)

npm test               # unit tests (src/**/*.spec.ts)
npm run test:cov       # with coverage
npm run test:e2e       # test/*.e2e-spec.ts. Loads .env.local or .env.development and needs a running Postgres

npx jest src/modules/students/services/student.service.spec.ts   # single file
npx jest -t "creates a student"                                          # single test by name
npm run test:release   # the PRD 11.5 release suites only (unit + e2e), see "CI"

npm run db:migrate     # apply pending migrations (see "Database migrations")
npm run db:seed:core   # seed platform accounts (see "Database seeding")
```

## CI

`.github/workflows/ci.yml` runs on every pull request and every push to `main`:

| Job | What it runs |
| --- | ------------ |
| Backend · lint, unit tests, build | `format:check`, `lint:check`, `typecheck`, `npm test`, `build` |
| Backend · e2e (Postgres 17, Redis) | `npm run test:e2e --runInBand` against service containers; the run creates its own `school_erp_e2e` database and restricted app role, so RLS is enforced |
| Frontend · build | `next build` (lint joins once its React Compiler errors are fixed) |

To reproduce the e2e job locally: `docker compose up -d postgres redis`, then `npm run test:e2e`.

### Release suites (PRD 11.5)

Every release needs the tenant isolation, GPA and fee regression suites at 100%. Tests that belong to one carry its tag in their `describe` or `it` name, so `npm run test:release` (or `-t "\[tenant-isolation\]"`) runs exactly them. CI runs them as part of the full suites.

| Tag | Covers | Where |
| --- | ------ | ----- |
| `[tenant-isolation]` | Repository scoping, RLS, cross-school tokens, handoff codes, job connections, per-school audit and settings | `test/tenant-isolation.e2e-spec.ts`, `src/tenancy/org-scoped-repository.spec.ts`, single cases in `jwt.strategy.spec.ts`, `handoff.spec.ts`, `tenant-job.runner.spec.ts`, `audit-log.e2e-spec.ts`, `settings.e2e-spec.ts` |
| `[gpa-regression]` | Grading engine regression suites (M5) | `src/modules/grading/engine/` (to come) |
| `[fee-regression]` | Fee calculation and allocation invariants (M6) | fees module (to come) |

A new test that checks one school can't see or change another school's data gets the `[tenant-isolation]` tag.

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

Platform and public routes (`organizations`, `memberships`, `platform/auth`, `platform/users`, `platform/audit-logs`, `platform/plans`, `oauth`, `public`, `health`, `dev/mail`) are excluded from `TenantMiddleware` in `src/app.module.ts`. If you add a new route of this kind, add it to that list too.

### Auth and RBAC

- **Platform realm** (`platform-jwt`): the platform console. A user's `users.platform_role` decides what they may do there, through the code-defined `PLATFORM_ROLE_PERMISSIONS` (`src/common/auth/platform-permissions.ts`): `super_admin` everything, `admin` everything but platform staff, `support` read-only plus resending an owner's activation link, `developer` read-only, `user` no console. Handlers use `@RequirePlatformPermissions(PLATFORM_PERMISSIONS.X)` with `PlatformPermissionsGuard`; services check `platformCan(ctx.user?.platformRole, …)`.
- **Tenant realm** (`JwtAuthGuard`): everything inside a school. Handlers use `@RequirePermissions(PERMISSIONS.X)` with `PermissionsGuard`.
- **Permissions** are defined in code in `src/modules/rbac/permissions.catalog.ts`, as `resource:action` keys. Roles are stored per tenant, and system roles are seeded from `system-roles.seed.ts`. Tenant users with `isAdmin` bypass permission checks. Roles have a scope (`school` or `assigned`); `AccessScope` (`src/modules/access-scope/`) tells section- and subject-level endpoints which sections and class subjects a scoped teacher may reach (assignments in effect today).
- **Settings:** `GET /settings` and `PATCH /settings/<section>` (profile, locale, numbering, portal, results, attendance, fees, notifications, security, organization), stored per school in `org_settings` and read through `SettingsService` with defaults filled in.
- **Plans and entitlements:** `plans` (Free/Basic/Standard/Premium) decide a school's modules and limits (`EntitlementService`, `@RequireModule`). Super-admins change plans, limits and trials under `/organizations/:id/…`; a trial grants Standard.
- **Signup, onboarding and Google sign-in:** `POST /public/signup` (+ `/verify`) creates a school after email verification; `/onboarding/*` holds the checklist and setup templates; `POST /public/find-school` mails sign-in links; `GET /oauth/google/start` signs in with Google on any school host (needs `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`).
- **Audit log:** sign-ins, role and member changes go to the school's append-only `audit_logs` (`AuditService`, `GET /audit-logs` with `audit:read`); platform actions go to `platform_audit_logs` (`PlatformAuditService`, `GET /platform/audit-logs`).

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
| Platform | `auth`, `users`, `organizations`, `memberships`, `plans`, `signup`, `oauth` |
| Tenant core | `auth`, `users`, `rbac`, `settings`, `onboarding`, `audit` |
| People | `students`, `guardians`, `employees`, `departments`, `designations` |
| Students | `students` (profile, status, documents, health, notes, export), `guardians`, `enrollments` (transfers, status), `promotions` (batches), `imports` (Excel), `certificates` (and ID cards), `student-overview` (360), `geo` (address pickers) |
| Academics | `academic-years`, `terms`, `shifts`, `rooms`, `classes`, `sections` (per class and session), `subjects`, `subject-groups`, `class-curriculum` (with subject components), `teaching` (effective-dated), `rollover`, `timetable` |
| Shared | `health`, `mail` (Handlebars templates + dev-only `dev/mail` trigger endpoints) |
| Samples | `cats`, `tasks`, `products` |

## First run: creating a platform admin

The quickest way in dev is `npm run db:seed:core`, which creates ready-to-use platform accounts (see [Database seeding](#database-seeding)). To create one by hand instead:

1. Register with `POST /api/platform/auth/register`.
2. Verify the email from the link in Mailpit (http://localhost:8025).
3. Give the account a platform role, for example in pgAdmin:
   ```sql
   UPDATE public.users SET platform_role = 'super_admin' WHERE email = 'you@example.com';
   ```
4. Log in with `POST /api/platform/auth/login` and create an organization through `/api/organizations`.
5. Tenant APIs are then reachable with an `x-tenant-id: <slug>` header, or through `http://<slug>.lvh.me:3900/api`.

## Database bootstrap

The database needs three things before the app can serve a school:

- **The schema:** tables, indexes and constraints.
- **The restricted app role** (`DB_APP_USERNAME`): the tenant pool connects as it, so row-level security applies. It has no superuser rights and owns no tables.
- **The RLS policies and grants:** an `org_isolation` policy on every org-scoped table, plus DML rights for the app role on the tables tenant requests use.

There are two ways to build a local database. Pick one per database and stick to it.

| | Sync (`DB_SYNC=true`) | Migrations (`DB_SYNC=false`) |
|---|---|---|
| Schema | Synced from the entities on every boot | `npm run db:migrate` |
| App role | Created on boot if missing | Create it before migrating (step 2 below) |
| RLS and grants | Re-applied on boot (`src/tenancy/rls.ts`) | `RowLevelSecurity` and `AppRoleGrants` migrations |
| Use it for | Quick prototyping on a throwaway DB | Day-to-day work, and before writing a migration. Matches production |

With sync, `docker compose up -d` and `npm run start:dev` are all you need. The rest of this section is the migrations path.

### Fresh local database with migrations

1. **Start the infrastructure** (from the repo root):
   ```bash
   docker compose up -d
   ```
   Postgres listens on `localhost:5433` (user `postgres`). The `school_erp` database is created by the container.

2. **Create the app role.** `AppRoleGrants` refuses to run without it (`role "school_erp_app" does not exist`). Use the password from `DB_APP_PASSWORD` in your env file (`.env.local` or `.env.development`):
   ```bash
   docker compose exec postgres psql -U postgres -d school_erp -c \
     "CREATE ROLE school_erp_app LOGIN PASSWORD '<DB_APP_PASSWORD>' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;"
   ```
   Roles belong to the Postgres server, not to one database. The role survives dropping and recreating `school_erp`, but not `docker compose down -v`, which deletes the volume.

   Instead of running the command, you can start the app once (`npm run start:dev`, any non-production `NODE_ENV`). It creates the role if it's missing. Do this only on an empty DB with `DB_SYNC=false`; otherwise sync builds the tables first and the initial migration then fails.

3. **Apply the migrations** (from `backend/`, with `DB_SYNC=false`):
   ```bash
   npm run db:migrate
   ```
   All pending migrations run in one transaction, so a failure leaves the DB untouched. Fix the cause and run it again.

4. **Seed the platform accounts:**
   ```bash
   npm run db:seed:core
   ```

5. **Start the app:**
   ```bash
   npm run start:dev
   ```
   Then sign in on the platform with `admin@biprodas.dev` / `sadmin@123` and create the first school (see [First run](#first-run-creating-a-platform-admin)). The owner's activation email lands in Mailpit (http://localhost:8025).

### Check that it worked

```bash
npm run db:status   # every migration shows [X]
docker compose exec postgres psql -U postgres -d school_erp -c \
  "SELECT count(*) AS rls_policies FROM pg_policies WHERE policyname = 'org_isolation';"
docker compose exec postgres psql -U postgres -d school_erp -c \
  "SELECT count(DISTINCT table_name) AS granted_tables FROM information_schema.role_table_grants WHERE grantee = 'school_erp_app';"
```

Both counts must be above zero. If the boot log warns `DB_APP_USERNAME is not set`, the tenant pool runs as the owner and RLS is not enforced.

### Reset a local database

```bash
docker compose exec postgres psql -U postgres -c "DROP DATABASE school_erp WITH (FORCE);"
docker compose exec postgres psql -U postgres -c "CREATE DATABASE school_erp;"
npm run db:migrate && npm run db:seed:core
```

The app role is kept, so there's no need to create it again. To wipe everything (all databases, roles, MinIO files and mail), run `docker compose down -v` from the repo root, then start again at step 1.

### Troubleshooting

| Error | Cause and fix |
|-------|---------------|
| `AppRoleGrants: role "school_erp_app" does not exist` | The app role is missing. Create it (step 2), then run `npm run db:migrate` again. |
| `relation "…" already exists` on `InitialSchema` | The DB was built with `DB_SYNC=true`. See [A dev DB that was built with `DB_SYNC=true`](#a-dev-db-that-was-built-with-db_synctrue). |
| `password authentication failed for user "school_erp_app"` | The role was created with a different password. Run `ALTER ROLE school_erp_app PASSWORD '<DB_APP_PASSWORD>';` as `postgres`. |
| `permission denied for table …` in tenant requests | A table has no grant for the app role. Its migration must grant it (see [Production](#production)). In dev, restarting the app re-applies the grants. |
| `ECONNREFUSED 127.0.0.1:5433` | Postgres isn't running. Run `docker compose up -d postgres` and check `docker compose ps`. |

## Database migrations

Migrations are TypeORM classes in `src/migrations/`, run through the CLI data source `src/database/public.datasource.ts`. That data source:

- **Env:** loads the same env files as the app (see [Environment](#environment)). Variables already set in the shell win, so `DB_NAME=other npm run db:migrate` works.
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

1. Point your DB at the latest migrations, not at sync: set `DB_SYNC=false` in your env file, then run `npm run db:migrate`. With `DB_SYNC=true` the app has already applied your entity changes, so `db:generate` finds nothing to diff.
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
- Create the restricted app role (`DB_APP_USERNAME`) yourself, with LOGIN NOSUPERUSER NOBYPASSRLS, not as the table owner:
  ```sql
  CREATE ROLE school_erp_app LOGIN PASSWORD '…' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  ```
- Run the migrations with `DB_APP_USERNAME` set. The `AppRoleGrants` migration then gives that role DML on exactly the tables tenant requests use (the org-scoped tables plus `users` and `auth_tokens`), and nothing on `organizations`, `migrations` or tables added later.
- A migration that adds a tenanted table must enable its RLS policy and `GRANT SELECT, INSERT, UPDATE, DELETE` on it to the app role (see `AppRoleGrants` for the pattern).

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

| Email | Username | Platform role | Console | Password |
|-------|----------|---------------|---------|----------|
| admin@biprodas.dev | sadmin | super_admin | everything | `sadmin@123` |
| biprodas@biprodas.dev | biprodas | admin | all but platform staff | `biprodas@123` |
| support@biprodas.dev | support | support | read-only, resend owner links | `support@123` |
| dev@biprodas.dev | dev | developer | read-only | `dev@123` |
| liyana@biprodas.dev | liyana | user | none | `liyana@123` |
| demo@pitchpool.io | demo | user | none | `demo@123` |

- **Re-runs:** the seeder is idempotent and matches users by email. New users are created ACTIVE and email-verified. Existing users get username, name and platform role re-synced but keep their current password.
- **Transactions:** each seeder runs in one transaction, so a failure leaves nothing half-written.

### Adding a seeder

1. Put the data in `src/database/seeds/data/<name>.data.ts` and the logic in `src/database/seeds/<name>.seeder.ts`. Export `async function seedX(ds: DataSource)`, and make it idempotent by looking rows up by a natural key before inserting.
2. Register it in the `SEEDERS` map in `run-seed.ts`.
3. Add `"db:seed:<name>": "ts-node src/database/seeds/run-seed.ts <name>"` to `package.json`.
4. Tenanted data must set `orgId` explicitly, because the owner connection bypasses RLS and the tenant repository scoping. Reuse the existing provisioning code where it fits, for example `RbacSeederService.seedSystemRoles(manager, orgId)` for an org's system roles.
