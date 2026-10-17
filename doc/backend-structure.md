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
├── database/                # TypeORM root module; CLI datasource for migrations
├── tenancy/                 # Shared-schema (org_id + RLS) infrastructure (see below)
├── modules/                 # All feature modules, flat (org-scoped = entity extends OrgScopedEntity)
│   ├── auth/                # Both realms: platform login ('platform-jwt') + tenant login (JwtAuthGuard),
│   │                        #   activation/reset/verification tokens, owner provisioning
│   ├── users/               # Global accounts (/platform/users) + members of the current org (/users)
│   ├── organizations/       # Organization (school) CRUD + provisioning; public lookup
│   ├── memberships/         # User ↔ organization memberships (role, isAdmin, status)
│   ├── rbac/                # Roles, user-roles, permission catalog, PermissionsGuard, system-role seeder
│   ├── students/            # Student profile + addresses, documents, medical records, emergency contacts, notes
│   ├── guardians/           # Guardians + student-guardian links
│   ├── employees/  departments/  designations/  stakeholders/
│   ├── academic-years/  classes/ (+ class sections)  sections/  subjects/  subject-groups/
│   ├── class-curriculum/    # Class ↔ subject / subject-group assignments
│   ├── enrollments/         # Enrollments + student subjects
│   ├── teaching/            # Class teachers, subject teachers
│   ├── timetable/           # Periods, class timetables
│   ├── promotions/
│   └── cats/  tasks/  products/   # Sample modules
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

Most modules keep files flat: `<feature>.module.ts`, `<feature>.controller.ts`, `<feature>.service.ts`, `<feature>.repository.ts`, `<feature>.service.spec.ts`, plus `dto/`, `entities/` and optionally `enums/`. Larger modules (`auth/`, `users/`, `organizations/`, `memberships/`, `students/`) split into `controllers/`, `services/`, `repositories/`. Not every module has a service spec yet. Some modules include a `.http` file with sample requests.

Every module must be imported in `app.module.ts`.

### `tenancy/`

| File | Role |
|------|------|
| `tenant.middleware.ts` | Resolves the organization from the `x-tenant-id` header, then the subdomain, then a custom domain; sets `req.orgId` / `req.orgSlug` |
| `tenant-slug.cache.ts` | In-memory slug/domain → tenant cache |
| `tenancy.module.ts` | Global module; applies RLS in dev, provides the restricted-role pool (`TENANT_POOL_DATASOURCE`) and request-scoped `TENANT_DATASOURCE` |
| `tenant-connection.service.ts` | Hands out connections with `app.org_id` set |
| `tenant-datasource.proxy.ts` | DataSource-like proxy over the scoped `EntityManager` (`orgId`, `getRepository`, `getManager`, `release`) |
| `org-scoped.entity.ts` | `OrgScopedEntity` base class (`org_id` + cascading FK) for every tenanted entity |
| `org-scoped-repository.ts` | `scopeRepository`: pins find/save/update/delete to one org |
| `rls.ts` | Row-level security policies, grants and dev app-role bootstrap |
| `tenant-cleanup.interceptor.ts` | Global interceptor that releases the connection after each request |
| `base-tenant.repository.ts` | Base class for tenanted repositories (auto-scoped for org-scoped entities) |
| `tenant.datasource.ts` | Entity globs and tenant pool options |
| `exceptions/` | Tenant-not-found / inactive / context-missing exceptions |

Entities are discovered by the glob `modules/**/entities/*.entity.ts`; all live in the `public` schema.

### Migrations

There are no migration files yet. In development the schema is synchronized when `DB_SYNC=true`, and `rls.ts` applies the RLS policies and grants. Migrations are generated with:

```bash
npx typeorm migration:generate src/migrations/<Name> -d src/database/public.datasource.ts
```

They must also carry the RLS policies/grants from `rls.ts`.

## Repo sibling of `src/`

```
backend/
├── src/                 # above
├── test/                # E2E: jest-e2e.json, setup-env.ts (loads .env.development), app/organization/user/membership e2e specs
├── dist/                # build output
├── .env.example         # env template (.env.development is loaded by default)
├── package.json         # scripts + Jest config (moduleNameMapper mirrors tsconfig paths)
├── nest-cli.json
├── tsconfig.json        # path aliases: ~/common, ~/config, ~/utils, ~/shared, ~/tenancy, ~/modules
├── tsconfig.build.json
└── eslint.config.mjs
```
