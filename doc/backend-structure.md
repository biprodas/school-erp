# Backend folder structure

Paths are relative to `backend/`.

## `src/`

```
src/
├── config/                  # Env validation (Joi) + typed config loaders: app, db, jwt, mailer, swagger, throttle, health
├── common/                  # Cross-cutting HTTP pieces
│   ├── decorators/          # @CurrentUser, request-context decorator
│   ├── dto/                 # RequestContextDto
│   ├── enums/               # Key (header/metadata keys), Environment
│   ├── filters/             # GlobalExceptionFilter
│   ├── guards/              # PlatformJwtAuthGuard, PlatformAdminGuard, SelfOrAdminGuard
│   ├── middlewares/         # RequestIdMiddleware
│   ├── throttling/          # TenantThrottlerGuard (global; per tenant + user/IP)
│   └── tokens/              # Secure token util, auth token types + TTLs
├── database/                # Public-schema TypeORM root module; CLI datasources (public, tenant migrations)
├── tenancy/                 # Schema-per-tenant infrastructure (see below)
├── modules/
│   ├── platform/            # Public-schema features (platform realm)
│   │   ├── auth/            # Platform login, 'platform-jwt' strategy
│   │   ├── users/           # Platform users
│   │   ├── tenants/         # Tenant CRUD + provisioning; public tenant lookup
│   │   └── memberships/     # User ↔ tenant memberships
│   └── tenanted/            # Tenant-schema features (tenant realm)
│       ├── auth/            # Tenant login, JwtAuthGuard, activation/reset tokens, owner provisioning
│       ├── users/           # Tenant users
│       ├── rbac/            # Roles, user-roles, permission catalog, PermissionsGuard, system-role seeder
│       ├── students/        # Student profile + addresses, documents, medical records, emergency contacts, notes
│       ├── guardians/       # Guardians + student-guardian links
│       ├── employees/  departments/  designations/  stakeholders/
│       ├── academic-years/  classes/ (+ class sections)  sections/  subjects/  subject-groups/
│       ├── class-curriculum/  # Class ↔ subject / subject-group assignments
│       ├── enrollments/     # Enrollments + student subjects
│       ├── teaching/        # Class teachers, subject teachers
│       ├── timetable/       # Periods, class timetables
│       ├── promotions/
│       └── cats/  tasks/  products/   # Sample modules
├── shared/
│   ├── health/              # HealthModule (@nestjs/terminus)
│   ├── mail/                # MailModule/MailService, Handlebars templates (activation, email-verification, password-reset, welcome), dev mail controller
│   ├── audit/               # Placeholder (empty index.ts)
│   └── jobs/                # Placeholder (empty index.ts)
├── utils/                   # request-context helpers
├── main.ts                  # Bootstrap: /api prefix, ValidationPipe, GlobalExceptionFilter, ClassSerializerInterceptor, helmet, CORS, Swagger
├── app.module.ts            # Imports every module; global throttler guard + tenant cleanup interceptor; TenantMiddleware with exclusions
├── app.controller.ts / app.service.ts / app.controller.spec.ts
```

### Feature module layout

Most modules keep files flat: `<feature>.module.ts`, `<feature>.controller.ts`, `<feature>.service.ts`, `<feature>.repository.ts`, `<feature>.service.spec.ts`, plus `dto/`, `entities/` and optionally `enums/`. Larger modules (`students/`, `platform/tenants/`, `platform/memberships/`) split into `controllers/`, `services/`, `repositories/`. Some modules include a `.http` file with sample requests.

Every module must be imported in `app.module.ts`.

### `tenancy/`

| File | Role |
|------|------|
| `tenant.middleware.ts` | Resolves the tenant from the `x-tenant-id` header, then the subdomain, then a custom domain; sets `req.tenantSchema` |
| `tenant-slug.cache.ts` | In-memory slug/domain → tenant cache |
| `tenancy.module.ts` | Global module; provides the shared pool (`TENANT_POOL_DATASOURCE`) and request-scoped `TENANT_DATASOURCE` |
| `tenant-connection.service.ts` | Hands out search_path-scoped connections; dev-only schema sync (also re-syncs all tenant schemas on boot when `DB_SYNC=true`) |
| `tenant-datasource.proxy.ts` | DataSource-like proxy over the scoped `EntityManager` (`getRepository`, `getManager`, `release`) |
| `tenant-cleanup.interceptor.ts` | Global interceptor that releases the connection after each request |
| `base-tenant.repository.ts` | Base class for tenanted repositories |
| `tenant-migration.service.ts` | Runs tenant migrations per schema / for all active tenants |
| `tenant.datasource.ts` | DataSource option builders for the pool and schema sync |
| `exceptions/` | Tenant-not-found / inactive / context-missing exceptions |

Entities are discovered by glob: `modules/platform/**/entities/*.entity.ts` → public schema, `modules/tenanted/**/entities/*.entity.ts` → tenant schemas.

### Migrations

There are no migration files yet. The datasources reference `src/migrations/public/` and `src/migrations/tenant/`, which don't exist. In development, schemas are synchronized when `DB_SYNC=true`. Tenant migrations are generated with:

```bash
npx typeorm migration:generate src/migrations/tenant/<Name> -d src/database/tenant-migration.datasource.ts
```

## Repo sibling of `src/`

```
backend/
├── src/                 # above
├── test/                # E2E: jest-e2e.json, setup-env.ts (loads .env.development), app/tenant/user/membership e2e specs
├── dist/                # build output
├── .env.example         # env template (.env.development is loaded by default)
├── package.json         # scripts + Jest config (moduleNameMapper mirrors tsconfig paths)
├── nest-cli.json
├── tsconfig.json        # path aliases: ~/common, ~/config, ~/utils, ~/shared, ~/tenancy, ~/platform, ~/tenanted
├── tsconfig.build.json
└── eslint.config.mjs
```
