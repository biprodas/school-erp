# Tenanted RBAC Module

> **Note (2026-10-17):** this document predates the move from schema-per-tenant to a shared schema with `org_id` + row-level security, tenants → organizations, and one global `users` table. See `CLAUDE.md` (Backend architecture) for the current design.

Technical documentation for the per-tenant access-control layer: **Tenant Users**, **Roles**, **User-Role Assignments**, and **Permission Enforcement**. Tenant-scoped authentication is covered in a separate section at the end.

All paths are relative to `backend/src/`.

---

## Overview

The tenanted RBAC layer operates inside each tenant's dedicated PostgreSQL schema (`tenant_<slug>`). It is distinct from the public-schema platform-admin layer and handles users, roles, permissions, and role-assignments **within** a single tenant.

```
tenant_<slug>.users  ──<  tenant_<slug>.user_roles  >──  tenant_<slug>.roles
                                                              │
                                                              ▼
                                                     permissions (string[])
                                                              │
                                                              ▼
                                              code-defined permission catalog
```

Two enforcement axes apply:

| Mechanism | Source | Effect |
|---|---|---|
| `User.isAdmin` flag | DB column on tenanted `users` | Bypasses every permission check inside the tenant |
| `@RequirePermissions(...)` | Decorator on route handlers | Resolved at request time against the union of the user's assigned-role permissions |

Every tenanted request is authenticated with a **tenant JWT** (Passport strategy `tenant-jwt`) and routed to the correct schema by `TenantMiddleware` based on either the `x-tenant-id` header or the subdomain.

```
Request
   │  x-tenant-id: acme  (or subdomain "acme.myapp.com")
   ▼
TenantMiddleware       → req.tenantId, req.tenantSchema, req.tenantSlug
   │  (validates tenant exists and status === active; cached for TTL)
   ▼
JwtAuthGuard           → req.user = { userId, email, tenantId, schemaName, isAdmin }
   ▼
PermissionsGuard       → admin bypass OR effective-permissions check
   ▼
Controller handler     → runs against the tenant-scoped DataSource
```

---

## 1. Users Module

**Location:** `modules/tenanted/users/`

### 1.1 Entity — `User`

Database table: `<tenant_schema>.users`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | Auto-generated |
| `email` | varchar | Unique, Not Null | Login identifier within tenant |
| `password` | varchar | Not Null, `select: false` | bcrypt-hashed (10 rounds) |
| `first_name` | varchar | Not Null | |
| `last_name` | varchar | Not Null | |
| `fullName` | virtual | | Re-computed via `@AfterLoad` / `@BeforeInsert` / `@BeforeUpdate` from first + last name (not persisted) |
| `status` | varchar | Not Null, default `active` | See `UserStatus` below |
| `is_admin` | boolean | Not Null, default `false` | Bypasses every RBAC check inside the tenant |
| `created_at` | timestamp | Not Null | Auto-set |
| `updated_at` | timestamp | Not Null | Auto-updated |
| `deleted_at` | timestamp | Nullable | TypeORM soft-delete column |

Relations:
- `userRoles` — OneToMany → `UserRole`

### 1.2 Enum — `UserStatus`

```ts
// modules/tenanted/users/enums/user-status.enum.ts
enum UserStatus {
  PENDING     = 'pending',
  ACTIVE      = 'active',
  SUSPENDED   = 'suspended',
  DEACTIVATED = 'deactivated',
  BANNED      = 'banned',
}
```

### 1.3 DTOs

**`CreateUserDto`**

| Field | Validation | Required |
|---|---|---|
| `firstName` | string, NotEmpty | Yes |
| `lastName` | string, NotEmpty | Yes |
| `email` | IsEmail, NotEmpty | Yes |
| `password` | string, MinLength(6) | Yes |
| `roleIds` | UUID[] (`v4`, each) | No — roles to assign on creation |
| `status` | IsEnum(UserStatus) | No — defaults to `active` |

**`UpdateUserDto`**

| Field | Validation |
|---|---|
| `firstName` | string |
| `lastName` | string |
| `status` | IsEnum(UserStatus) |

**`FilterUserDto`** (query string on `GET /users`)

| Field | Validation | Behaviour |
|---|---|---|
| `id` | string | Exact match |
| `firstName` | string | Exact match |
| `lastName` | string | Exact match |
| `email` | string | Exact match |
| `roleId` | UUID | Returns users that hold this role |

### 1.4 Service — `UserService`

| Method | Signature | Description |
|---|---|---|
| `findFiltered` | `(dto: FilterUserDto): Promise<User[]>` | If `roleId` set, joins `user_roles`; else filters by other fields |
| `findById` | `(id: string): Promise<User>` | Throws `NotFoundException` if absent |
| `create` | `(dto): Promise<User>` | Validates each `roleIds[*]` exists; hashes password; creates user; assigns roles in a second loop; rejects duplicate email |
| `update` | `(id, dto): Promise<User>` | Updates first/last name and/or status |
| `remove` | `(id): Promise<void>` | Soft delete via TypeORM (`deleted_at`) |
| `getProfile` | `(userId): Promise<User>` | Returns user without password field |
| `grantAdmin` | `(id): Promise<User>` | Sets `is_admin = true` (no-op if already true) |
| `revokeAdmin` | `(id): Promise<User>` | Sets `is_admin = false` (no-op if already false) |

### 1.5 Controller — `UserController`

Route prefix: `users`
Global guards: `JwtAuthGuard`, `PermissionsGuard`
Required header: `x-tenant-id: <tenant-slug>` (or subdomain resolution)

| Method | Path | Decorator | Description |
|---|---|---|---|
| GET | `/` | `@RequirePermissions(USERS_READ)` | List users (filterable via `FilterUserDto`) |
| POST | `/` | `@RequirePermissions(USERS_CREATE)` | Create user and optionally assign roles |
| GET | `/:id` | `@RequirePermissions(USERS_READ)` | Get user by id |
| PATCH | `/:id` | `@RequirePermissions(USERS_UPDATE)` | Update first/last name and/or status |
| DELETE | `/:id` | `@RequirePermissions(USERS_DELETE)` | Soft-delete user |
| POST | `/:id/grant-admin` | `@UseGuards(IsAdminGuard)` | Promote user to tenant admin (admin-only, **no** permission decorator) |
| POST | `/:id/revoke-admin` | `@UseGuards(IsAdminGuard)` | Demote tenant admin |

---

## 2. RBAC Module

**Location:** `modules/tenanted/rbac/`

### 2.1 Permission Catalog

**File:** `permissions.catalog.ts` — the **single source of truth** for every action that can be gated inside a tenant. Permission keys follow the `resource:action` convention. The catalog is **code-defined, not DB-stored**, so route guards and stored role definitions cannot drift apart.

```ts
export const PERMISSIONS = {
  // Tenant users
  USERS_READ:    'users:read',
  USERS_CREATE:  'users:create',
  USERS_UPDATE:  'users:update',
  USERS_DELETE:  'users:delete',

  // Students
  STUDENTS_READ:    'students:read',
  STUDENTS_CREATE:  'students:create',
  STUDENTS_UPDATE:  'students:update',
  STUDENTS_DELETE:  'students:delete',

  // Cats
  CATS_READ:    'cats:read',
  CATS_CREATE:  'cats:create',
  CATS_UPDATE:  'cats:update',
  CATS_DELETE:  'cats:delete',

  // Tasks
  TASKS_READ:    'tasks:read',
  TASKS_CREATE:  'tasks:create',
  TASKS_UPDATE:  'tasks:update',
  TASKS_DELETE:  'tasks:delete',

  // Products
  PRODUCTS_READ:    'products:read',
  PRODUCTS_CREATE:  'products:create',
  PRODUCTS_UPDATE:  'products:update',
  PRODUCTS_DELETE:  'products:delete',

  // Access control management
  ROLES_READ:    'roles:read',
  ROLES_MANAGE:  'roles:manage',
  ROLES_ASSIGN:  'roles:assign',
} as const;
```

Helpers exported alongside the catalog:
- `ALL_PERMISSIONS` — array of every permission key (used to seed the `admin` role)
- `PERMISSION_SET: ReadonlySet<string>` — O(1) validation set used by `RoleService.validatePermissions`
- `getPermissionCatalog()` — groups permissions by resource for the `GET /permissions` response

### 2.2 System Roles

**File:** `system-roles.seed.ts` — seven roles seeded into every tenant schema on creation. System roles carry `isSystem = true`: they **cannot be renamed or deleted**, but their permission lists **can** be edited via `PATCH /roles/:id` or `PUT /roles/:id/permissions`.

| Role | Description | Permissions |
|---|---|---|
| `admin` | Full tenant administrator | `ALL_PERMISSIONS` |
| `staff` | General school staff | `users:read`, all `students:*`, all `cats:*`, all `tasks:*`, `products:read` |
| `teacher` | Teaching staff | `users:read`, `students:read`, `tasks:read`, `tasks:create`, `tasks:update`, `cats:read`, `products:read` |
| `accountant` | Finance and inventory | `users:read`, `students:read`, all `products:*` |
| `librarian` | Library management | `users:read`, `students:read`, all `cats:*`, `products:read` |
| `parent` | Parent or guardian | `students:read`, `tasks:read`, `products:read` |
| `student` | Student | `tasks:read` |

The constant `ADMIN_ROLE_NAME = 'admin'` is referenced by `RoleService.unassignRole` to enforce the "last admin assignment cannot be removed" safeguard.

### 2.3 Entities

#### `Role` — table `<tenant_schema>.roles`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | Auto-generated |
| `name` | varchar | Unique, Not Null | Role identifier; case-sensitive |
| `description` | varchar(255) | Nullable | Free-text |
| `permissions` | text[] | Not Null, default `{}` | Array of permission keys from the catalog |
| `is_system` | boolean | Not Null, default `false` | System roles cannot be deleted or renamed |
| `created_at` | timestamp | Not Null | Auto-set |
| `updated_at` | timestamp | Not Null | Auto-updated |

Relation: `userRoles` — OneToMany → `UserRole`

#### `UserRole` — table `<tenant_schema>.user_roles`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | Auto-generated |
| `user_id` | uuid | FK → `users(id)`, **CASCADE DELETE** | |
| `role_id` | uuid | FK → `roles(id)`, **CASCADE DELETE** | |
| `created_at` | timestamp | Not Null | Auto-set |

Index: `uq_user_roles_user_role` — unique on `(user_id, role_id)` — a user holds each role at most once.

Relations:
- `user` — ManyToOne → `User`
- `role` — ManyToOne → `Role`

### 2.4 DTOs

**`CreateRoleDto`**

| Field | Validation | Required |
|---|---|---|
| `name` | string, Length(2, 64) | Yes |
| `description` | string, MaxLength(255) | No |
| `permissions` | string[] (each IsString) | No — defaults to `[]`; validated against `PERMISSION_SET` in service |

**`UpdateRoleDto`**

All fields optional. `name` change on a system role → 403.

| Field | Validation |
|---|---|
| `name` | string, Length(2, 64) |
| `description` | string, MaxLength(255) |
| `permissions` | string[] (each IsString) — replaces the existing list |

**`SetPermissionsDto`** (body of `PUT /roles/:id/permissions`)

| Field | Validation |
|---|---|
| `permissions` | string[] (each IsString) — validated against catalog |

**`AssignRoleDto`** (body of `POST /users/:userId/roles`)

| Field | Validation |
|---|---|
| `roleId` | IsUUID |

### 2.5 Services

#### `RoleService`

| Method | Signature | Description |
|---|---|---|
| `findAll` | `(): Promise<Role[]>` | Returns all roles ordered by name ASC |
| `findById` | `(id): Promise<Role>` | Throws `NotFoundException` if absent |
| `create` | `(dto): Promise<Role>` | Validates permission keys; rejects duplicate name; `isSystem = false` |
| `update` | `(id, dto): Promise<Role>` | Updates name / description / permissions; 403 if renaming a system role; 409 on name clash |
| `setPermissions` | `(id, permissions): Promise<Role>` | Atomically replaces the role's permission list |
| `remove` | `(id, force?): Promise<void>` | 403 on system role; 409 if assigned to users unless `force = true` |
| `getUserRoles` | `(userId): Promise<Role[]>` | All roles assigned to a user (filters out broken relations) |
| `assignRole` | `(userId, roleId): Promise<void>` | Idempotent — re-assigning is a no-op (unique index handles it) |
| `unassignRole` | `(userId, roleId): Promise<void>` | Refuses to remove the **last** assignment of the `admin` role from any user |
| `validatePermissions` *(private)* | `(permissions): string[]` | De-duplicates and rejects unknown keys via `PERMISSION_SET` |

#### `PermissionResolverService`

| Method | Signature | Description |
|---|---|---|
| `getEffectivePermissions` | `(userId): Promise<Set<string>>` | Loads all `UserRole`s for the user (eager-loads `role`) and returns the **union** of every assigned role's permissions |
| `getRoles` | `(userId): Promise<Role[]>` | Convenience: just the role objects |

Permissions are resolved **fresh per request**, against the request-scoped tenant connection, so permission changes take effect immediately.

#### `RbacSeederService`

| Method | Signature | Description |
|---|---|---|
| `seedSystemRoles` | `(schemaName): Promise<void>` | Acquires a scoped tenant connection, inserts each `SYSTEM_ROLES` entry that does not yet exist (matched by `name`), then releases. Idempotent — safe for back-filling old tenants. |

Called from the platform `TenantService.createTenant` flow after schema provisioning.

### 2.6 Controllers

#### `RoleController` at prefix `roles`

Global guards: `JwtAuthGuard`, `PermissionsGuard`

| Method | Path | Decorator | Description |
|---|---|---|---|
| GET | `/` | `@RequirePermissions(ROLES_READ)` | List all roles |
| GET | `/:id` | `@RequirePermissions(ROLES_READ)` | Get role by id |
| POST | `/` | `@RequirePermissions(ROLES_MANAGE)` | Create a custom role |
| PATCH | `/:id` | `@RequirePermissions(ROLES_MANAGE)` | Update name / description / permissions |
| PUT | `/:id/permissions` | `@RequirePermissions(ROLES_MANAGE)` | Replace the permission list (`SetPermissionsDto`) |
| DELETE | `/:id` | `@RequirePermissions(ROLES_MANAGE)` | Delete role; append `?force=true` to cascade-remove assignments; returns `204` |

#### `UserRoleController` at prefix `users/:userId/roles`

Global guards: `JwtAuthGuard`, `PermissionsGuard`

| Method | Path | Decorator | Description |
|---|---|---|---|
| GET | `/` | `@RequirePermissions(ROLES_READ)` | List roles assigned to the user |
| POST | `/` | `@RequirePermissions(ROLES_ASSIGN)` | Assign a role (`AssignRoleDto`); idempotent |
| DELETE | `/:roleId` | `@RequirePermissions(ROLES_ASSIGN)` | Unassign a role; refuses if removing the last `admin` assignment |

#### `PermissionController` at prefix `permissions`

Global guards: `JwtAuthGuard`, `PermissionsGuard`

| Method | Path | Decorator | Description |
|---|---|---|---|
| GET | `/` | `@RequirePermissions(ROLES_READ)` | Returns the catalog grouped by resource: `[{ resource, permissions: [{ key, action }] }]` |

### 2.7 Guards & Decorators

| Artifact | File | Purpose |
|---|---|---|
| `JwtAuthGuard` | `auth/jwt-auth.guard.ts` | Validates Bearer token using the `tenant-jwt` strategy; populates `request.user` |
| `PermissionsGuard` | `rbac/permissions.guard.ts` | Reads `@RequirePermissions()` metadata; if absent → allow; if `request.user.isAdmin === true` → allow (bypass); else resolves effective permissions and allows when **at least one** required key is present |
| `IsAdminGuard` | `rbac/is-admin.guard.ts` | 403 with message `"Admin only"` unless `request.user.isAdmin === true` |
| `@RequirePermissions(...keys)` | `rbac/require-permissions.decorator.ts` | Attaches `Key.Permissions` metadata; **OR semantics** across keys (passing any one is sufficient) |

Standard usage pattern:

```ts
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('students')
export class StudentController {
  @Get()
  @RequirePermissions(PERMISSIONS.STUDENTS_READ)
  findAll() { ... }

  // OR semantics: passes if user has ROLES_READ OR ROLES_MANAGE
  @Get('catalog')
  @RequirePermissions(PERMISSIONS.ROLES_READ, PERMISSIONS.ROLES_MANAGE)
  listRolesAndPerms() { ... }
}
```

---

## 3. Tenant Authentication

**Location:** `modules/tenanted/auth/`

### 3.1 Endpoints

Route prefix: `auth`. Every request must carry the `x-tenant-id` header (or arrive on a tenant subdomain).

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Register a new user inside the tenant. **The first registered user in a tenant becomes `isAdmin = true`** so they can bootstrap the rest of the tenant. |
| POST | `/auth/login` | Public | Email + password → JWT |
| GET | `/auth/me` | `JwtAuthGuard` | Current user profile + role names |

### 3.2 Request / Response Shapes

**Register / Login response (`data` field of the envelope):**

```json
{
  "access_token": "<jwt>",
  "token_type": "Bearer",
  "user": {
    "id": "<uuid>",
    "email": "user@example.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "fullName": "Jane Doe",
    "roles": ["staff", "teacher"],
    "status": "active",
    "isAdmin": false
  },
  "tenant": {
    "id": "<uuid>",
    "slug": "acme",
    "schema": "tenant_acme"
  }
}
```

All endpoints are wrapped in the project's standard envelope: `{ success, statusCode, message, data }`.

### 3.3 JWT Payload

```json
{
  "sub": "<userId>",
  "email": "user@example.com",
  "tenantId": "<tenantId>",
  "schemaName": "tenant_<slug>",
  "isAdmin": true,
  "iat": 1700000000,
  "exp": 1700086400
}
```

JWT expiry defaults to 24h (configurable via `jwt.expiresIn`). The token uses the **same secret** as the platform JWT (`jwt.secret`), but the `tenantId` / `schemaName` claims plus the `tenant-jwt` strategy name distinguish tenanted tokens at the controller level.

`JwtStrategy.validate()` returns the request user as:

```ts
{ userId, email, tenantId, schemaName, isAdmin }
```

### 3.4 Tenant Resolution

**File:** `tenancy/tenant.middleware.ts`

1. Read tenant slug from header `x-tenant-id`; otherwise from the first subdomain (excluding `www` / `api`).
2. If no slug → `TenantContextMissingException`.
3. If slug fails the pattern `/^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$/` → `TenantNotFoundException`.
4. Look up the tenant (slug-keyed cache with TTL) → `TenantNotFoundException` if missing.
5. If `tenant.status !== ACTIVE` → `TenantInactiveException`.
6. Populate `req.tenantId`, `req.tenantSchema`, `req.tenantSlug`.

The tenant connection layer (`TenantConnectionService` + `BaseTenantRepository`) uses these properties to `SET search_path` to the tenant schema, so repository queries are automatically scoped — no per-call tenant filtering is required.

---

## 4. Module Dependency Graph

```
TenantedModule
├── AuthModule
│   ├── PassportModule
│   ├── JwtModule.registerAsync(...)
│   ├── TenantUserModule  (UserRepository, UserService for login/register)
│   └── RbacModule        (UserRoleRepository for role names in JWT response)
│
├── TenantUserModule
│   └── RbacModule        (RoleRepository + UserRoleRepository for role validation
│                          and assignment during user creation)
│
└── RbacModule  ── exports:
        RoleService, RoleRepository, UserRoleRepository,
        PermissionResolverService, PermissionsGuard,
        IsAdminGuard, RbacSeederService
```

External caller of `RbacSeederService`: the platform-side `TenantService.createTenant()` invokes `seedSystemRoles(schemaName)` after the tenant schema has been provisioned and migrated.

---

## 5. Authorization Matrix

`A` = Tenant Admin (`isAdmin = true`); permission columns assume `isAdmin = false`.

| Action | Tenant Admin | Holder of relevant permission | No permission | Unauthenticated |
|---|---|---|---|---|
| Register first user in tenant (becomes admin) | — | — | — | Yes |
| Log in | A | Yes | Yes | No |
| View own profile (`GET /auth/me`) | A | Yes | Yes | No |
| List users (`GET /users`) | A | `users:read` | No | No |
| Create user (`POST /users`) | A | `users:create` | No | No |
| Update user (`PATCH /users/:id`) | A | `users:update` | No | No |
| Delete user (`DELETE /users/:id`) | A | `users:delete` | No | No |
| Grant / revoke admin | A | No (admin-only) | No | No |
| List / view roles | A | `roles:read` | No | No |
| Create / update / delete role | A | `roles:manage` | No | No |
| Replace role permissions | A | `roles:manage` | No | No |
| List user's role assignments | A | `roles:read` | No | No |
| Assign / unassign role to a user | A | `roles:assign` | No | No |
| View permission catalog | A | `roles:read` | No | No |
| Resource CRUD (students / cats / tasks / products) | A | matching `<resource>:<action>` permission | No | No |

Notes:
- "OR semantics": a handler decorated with `@RequirePermissions(A, B)` accepts a user holding **either** A or B.
- The `admin` role's permission list equals `ALL_PERMISSIONS`, so a user assigned only the `admin` role has full coverage even **without** the `isAdmin` flag. The `isAdmin` flag is a separate, faster bypass and is what's set on the first registered user.

---

## 6. Error Reference

| Scenario | Exception | HTTP | Message |
|---|---|---|---|
| Duplicate email on register / user create | `ConflictException` | 409 | `User already exists` / `Email already registered` |
| Invalid email or password on login | `UnauthorizedException` | 401 | `Invalid credentials` |
| `getMe` user not found | `UnauthorizedException` | 401 | `User not found` |
| Duplicate role name | `ConflictException` | 409 | `Role "<name>" already exists` |
| Unknown permission key | `BadRequestException` | 400 | `Unknown permission(s): <list>` |
| Renaming a system role | `ForbiddenException` | 403 | `System roles cannot be renamed` |
| Deleting a system role | `ForbiddenException` | 403 | `System roles cannot be deleted` |
| Deleting a role still assigned to users (no `?force=true`) | `ConflictException` | 409 | `Role is assigned to N user(s). Pass ?force=true …` |
| Removing the last `admin` role assignment | `ConflictException` | 409 | `Cannot remove the last admin role assignment` |
| Missing one of the required permissions | `ForbiddenException` | 403 | `Missing required permission: X or Y` |
| Permission check before auth resolved | `UnauthorizedException` | 401 | `Authentication required` |
| Non-admin hitting an `IsAdminGuard` route | `ForbiddenException` | 403 | `Admin only` |
| Missing `x-tenant-id` and no subdomain | `TenantContextMissingException` | 400 | — |
| Slug pattern fails or tenant not found | `TenantNotFoundException` | 404 | — |
| Tenant status !== `active` | `TenantInactiveException` | 403 | — |
| Invalid / missing JWT | `UnauthorizedException` (via Passport) | 401 | — |
| DTO validation failure | `BadRequestException` (via ValidationPipe) | 400 | — |

---

## 7. End-to-End Example

**Bootstrap a tenant and grant a custom role.**

```
1. Platform-side: a school owner creates tenant "acme".
   - TenantService inserts the tenant row, provisions schema `tenant_acme`,
     runs migrations, calls RbacSeederService.seedSystemRoles('tenant_acme').
   - All seven SYSTEM_ROLES (admin, staff, teacher, …) now exist.

2. Tenanted-side: the first user registers.
   POST /auth/register   (x-tenant-id: acme)
   { firstName, lastName, email, password }
   → User.count() === 0 → user.isAdmin = true
   → JWT issued.

3. The admin creates a custom role.
   POST /roles  + @RequirePermissions(ROLES_MANAGE) – bypassed by isAdmin
   { name: "reviewer", description: "...",
     permissions: ["students:read", "tasks:read"] }

4. The admin assigns the role to user B.
   POST /users/<userId-B>/roles  { roleId: "<reviewer-id>" }

5. User B logs in, calls GET /students.
   - JwtAuthGuard validates token; isAdmin = false.
   - PermissionsGuard resolves effective permissions:
       union of every role's permissions = { "students:read", "tasks:read" }
   - "students:read" is in the set → request allowed.

6. The same user calls POST /students.
   - Effective set lacks "students:create" → 403 Forbidden
     with message "Missing required permission: students:create".
```
