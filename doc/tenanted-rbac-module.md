# Tenanted RBAC Module

Technical documentation for the per-organization (school) access-control layer: **Organization Members**, **Roles**, **User-Role Assignments**, and **Permission Enforcement**. Tenant-scoped authentication and the tenancy plumbing it relies on are covered in section 3.

All paths are relative to `backend/src/`. Every route below sits under the global prefix `/api` (e.g. `GET /api/roles`).

---

## Overview

All data lives in one Postgres schema (`public`). A school is an **organization** (`organizations` table). User accounts are **global** (one `users` table, one login across schools); everything that is per-school about a user lives in org-scoped tables:

```
users (global)  ──<  memberships (org_id, role, is_admin, status)  >──  organizations
   │                                                                        │
   └──<  user_roles (org_id, user_id, role_id)  >──  roles (org_id, name, permissions text[])
                                                          │
                                                          ▼
                                            code-defined permission catalog
```

Two enforcement axes apply inside an organization:

| Mechanism | Source | Effect |
|---|---|---|
| `isAdmin` (school admin) | `memberships.is_admin`, copied into the tenant JWT at sign-in | Bypasses every `@RequirePermissions` check inside that organization |
| `@RequirePermissions(...)` | Decorator on route handlers | Resolved per request against the union of the permissions of the user's roles in that organization |

`users.is_admin` is a different flag: it marks a **platform** admin and is only read by the platform realm (`PlatformAdminGuard`). It has no effect inside a school.

### Request flow

```
Request
   │  x-tenant-id: acme   (or subdomain acme.<root-domain>, or a custom domain)
   ▼
TenantMiddleware          → req.orgId, req.orgSlug
   │  (org must exist and be ACTIVE; slug/domain lookups cached 60 s)
   ▼
JwtAuthGuard ('jwt')      → JwtStrategy.validate: payload.orgId must equal req.orgId
   │                        req.user = { userId, email, orgId, isAdmin }
   ▼
PermissionsGuard          → no metadata → allow; isAdmin → allow;
   │                        else effective permissions must contain ≥ 1 required key
   ▼
Controller / service      → repositories built on TENANT_DATASOURCE
   │                        (QueryRunner with set_config('app.org_id', orgId))
   ▼
TenantCleanupInterceptor  → RESET app.org_id, release the QueryRunner
```

### Two isolation layers

| Layer | Where | What it does |
|---|---|---|
| App level | `tenancy/org-scoped-repository.ts` (`scopeRepository`), applied by `BaseTenantRepository` | For entities with an `orgId` property, `find*` / `count` / `exists` (+ `*By` variants) get `orgId` merged into `where`; `create` / `save` / `insert` stamp `orgId` and throw `403 Cross-organization write blocked` if the data names another org; `update` / `delete` / `softDelete` / `restore` criteria are pinned to the org. **Query builders are not rewritten**: add `.andWhere('alias.orgId = :orgId', { orgId: this.orgId })` yourself. |
| Database level | `tenancy/rls.ts` | Every table with a NOT NULL `org_id` gets RLS enabled and policy `org_isolation`: `USING (org_id = NULLIF(current_setting('app.org_id', true), '')::uuid) WITH CHECK (same)`. Unset setting → no rows (fail closed). Applies only to the restricted pool role `DB_APP_USERNAME`; the root connection (table owner) bypasses RLS because policies use `ENABLE`, not `FORCE`. |

Tables with a nullable `org_id` (e.g. `auth_tokens`) and tables without one (`users`, `organizations`) get no RLS policy.

---

## 1. Users Module (tenant side)

**Location:** `modules/users/`

The module holds both realms. The platform side (`PlatformUserController` on `/platform/users`, `UserService`) manages global accounts and is out of scope here. The tenant side is `OrgUserController` / `OrgUserService`: it manages the **members of the current organization**, i.e. global accounts joined with their membership and roles.

### 1.1 Entities

#### `User` — table `public.users` (global, not org-scoped)

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | Auto-generated |
| `email` | varchar | Unique, Not Null | Global login identifier (one account across schools) |
| `password` | varchar | Not Null, `select: false` | bcrypt-hashed (10 rounds) |
| `name` | varchar | Not Null | Single display name |
| `status` | enum `UserStatus` | Not Null, default `active` | Global account status |
| `is_admin` | boolean | Not Null, default `false` | **Platform** admin flag (not the school admin flag) |
| `email_verified_at` | timestamptz | Nullable | Set on email verification or activation |
| `created_at` | timestamp | Not Null | Auto-set |
| `updated_at` | timestamp | Not Null | Auto-updated |
| `deleted_at` | timestamp | Nullable | TypeORM soft-delete column |

Relations: `memberships` — OneToMany → `Membership`.

#### `Membership` — table `public.memberships` (org-scoped, RLS-protected)

Lives in `modules/memberships/entities/membership.entity.ts`. It declares its own `org_id` column (it does not extend `OrgScopedEntity`), but the column is NOT NULL, so RLS applies and `BaseTenantRepository` scopes it.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | Auto-generated |
| `user_id` | uuid | FK → `users(id)`, CASCADE DELETE | |
| `org_id` | uuid | FK → `organizations(id)`, CASCADE DELETE, indexed | |
| `role` | enum `MembershipRole` | Not Null, default `member` | `owner` / `admin` / `member` (organization-level role, distinct from RBAC roles) |
| `is_admin` | boolean | Not Null, default `false` | School admin: bypasses tenant RBAC in this org |
| `status` | enum `MembershipStatus` | Not Null, default `active` | Standing inside this org |
| `created_at` | timestamp | Not Null | Auto-set |
| `updated_at` | timestamp | Not Null | Auto-updated |

Index: `uq_memberships_org_user` — unique on `(org_id, user_id)`.

### 1.2 Enums

```ts
// modules/users/enums/user-status.enum.ts  (global account)
enum UserStatus {
  PENDING     = 'pending',
  ACTIVE      = 'active',
  SUSPENDED   = 'suspended',
  DEACTIVATED = 'deactivated',
  BANNED      = 'banned',
}

// modules/memberships/enums/membership-status.enum.ts  (per org)
enum MembershipStatus {
  PENDING     = 'pending',     // provisioned/invited, must activate before logging in
  ACTIVE      = 'active',
  SUSPENDED   = 'suspended',
  DEACTIVATED = 'deactivated',
}

// modules/memberships/enums/membership-role.enum.ts
enum MembershipRole {
  OWNER  = 'owner',
  ADMIN  = 'admin',
  MEMBER = 'member',
}
```

### 1.3 DTOs

**`CreateOrgUserDto`**

| Field | Validation | Required |
|---|---|---|
| `name` | string, NotEmpty | Yes |
| `email` | IsEmail, NotEmpty | Yes |
| `password` | string, MinLength(6) | Yes (ignored when the email already has an account) |
| `roleIds` | UUID[] (`v4`, each) | No — roles to assign on creation |
| `status` | IsEnum(MembershipStatus) | No — defaults to `active` |

**`UpdateOrgUserDto`**

| Field | Validation | Effect |
|---|---|---|
| `name` | string | Updates the **global** account name (visible in every org) |
| `status` | IsEnum(MembershipStatus) | Updates the membership status in this org |

**`FilterOrgUserDto`** (query string on `GET /users`)

| Field | Validation | Behaviour |
|---|---|---|
| `id` | string | Exact match on user id |
| `name` | string | Exact match on account name |
| `email` | string | Exact match on account email |
| `roleId` | UUID | Only members holding this role |

### 1.4 Response shape — `SerializedUser`

Every `/users` endpoint returns members in this shape (`id` is the global user id, usable with `/users/:userId/roles`):

```ts
{
  id: string;               // users.id
  membershipId: string;     // memberships.id
  email: string;
  name: string;
  status: MembershipStatus; // membership status, not the account status
  isAdmin: boolean;         // memberships.is_admin
  emailVerifiedAt: Date | null;
  roles: { id: string; name: string }[];
  createdAt: Date;          // membership timestamps
  updatedAt: Date;
}
```

### 1.5 Repositories

| Repository | File | Entity | Scoped? | Purpose |
|---|---|---|---|---|
| `AccountRepository` | `users/repositories/account.repository.ts` | `User` | No (no `orgId`) | `findByEmail`, `findByEmailWithPassword`, `findByIdWithPassword`, `findByIds`. Identity operations only; membership is checked separately. |
| `MemberRepository` | `users/repositories/member.repository.ts` | `Membership` | Yes | `findByUserId(userId)` (joins `user`), `findFiltered({ userId, userIds, name, email })` ordered by `createdAt ASC`. Provided and exported by `RbacModule`. |

Both extend `BaseTenantRepository` and inject `TENANT_DATASOURCE`, so they are request-scoped.

### 1.6 Service — `OrgUserService`

| Method | Signature | Description |
|---|---|---|
| `findFiltered` | `(dto: FilterOrgUserDto): Promise<SerializedUser[]>` | If `roleId` set, looks up its assignments first (returns `[]` if none); then filters memberships |
| `findById` | `(id: string): Promise<SerializedUser>` | `404 User with id "<id>" not found` if the user is not a member of this org |
| `create` | `(dto: CreateOrgUserDto): Promise<SerializedUser>` | Validates every `roleIds[*]` exists first; if the email already has an account it is linked as-is (password unchanged), else a new account is created (`status: active`, bcrypt password); `409` if already a member; creates the membership (`status` default `active`); assigns roles |
| `update` | `(id, dto: UpdateOrgUserDto): Promise<SerializedUser>` | Updates membership `status` and/or account `name` |
| `remove` | `(id): Promise<void>` | Removes the user's role assignments in this org, then hard-deletes the membership. The global account is untouched. |
| `getProfile` | `(userId): Promise<SerializedUser>` | Alias of `findById` |
| `grantAdmin` | `(id): Promise<SerializedUser>` | Sets `memberships.is_admin = true` (no-op if already true) |
| `revokeAdmin` | `(id): Promise<SerializedUser>` | Sets `memberships.is_admin = false` (no-op if already false) |

### 1.7 Controller — `OrgUserController`

Route prefix: `users`
Controller guards: `JwtAuthGuard`, `PermissionsGuard`
Swagger: `@ApiBearerAuth('tenant-jwt')`, `@ApiHeader({ name: 'x-tenant-id' })`

| Method | Path | Decorator | Description |
|---|---|---|---|
| GET | `/users` | `@RequirePermissions(USERS_READ)` | List members (filterable via `FilterOrgUserDto`) |
| POST | `/users` | `@RequirePermissions(USERS_CREATE)` | Add a member (new or existing account) and optionally assign roles |
| GET | `/users/:id` | `@RequirePermissions(USERS_READ)` | Get member by user id |
| PATCH | `/users/:id` | `@RequirePermissions(USERS_UPDATE)` | Update name and/or membership status |
| DELETE | `/users/:id` | `@RequirePermissions(USERS_DELETE)` | Remove from this org (membership + role assignments) |
| POST | `/users/:id/grant-admin` | `@UseGuards(IsAdminGuard)` | Make the member a school admin (admin-only, **no** permission decorator) |
| POST | `/users/:id/revoke-admin` | `@UseGuards(IsAdminGuard)` | Remove school admin |

All `:id` params use `ParseUUIDPipe`. Responses use the `{ success, statusCode, message, data }` envelope.

---

## 2. RBAC Module

**Location:** `modules/rbac/` (flat layout; `dto/` and `entities/` subfolders)

### 2.1 Permission Catalog

**File:** `permissions.catalog.ts` — the **single source of truth** for every action that can be gated inside an organization. Keys follow the `resource:action` convention. The catalog is **code-defined, not DB-stored**; roles store keys from it.

```ts
export const PERMISSIONS = {
  // Tenant users
  USERS_READ: 'users:read',
  USERS_CREATE: 'users:create',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',

  // Students
  STUDENTS_READ: 'students:read',
  STUDENTS_CREATE: 'students:create',
  STUDENTS_UPDATE: 'students:update',
  STUDENTS_DELETE: 'students:delete',

  // Student documents
  STUDENT_DOCUMENTS_READ: 'student_documents:read',
  STUDENT_DOCUMENTS_CREATE: 'student_documents:create',
  STUDENT_DOCUMENTS_UPDATE: 'student_documents:update',
  STUDENT_DOCUMENTS_DELETE: 'student_documents:delete',

  // Student medical records
  STUDENT_MEDICAL_READ: 'student_medical:read',
  STUDENT_MEDICAL_CREATE: 'student_medical:create',
  STUDENT_MEDICAL_UPDATE: 'student_medical:update',
  STUDENT_MEDICAL_DELETE: 'student_medical:delete',

  // Student notes
  STUDENT_NOTES_READ: 'student_notes:read',
  STUDENT_NOTES_CREATE: 'student_notes:create',
  STUDENT_NOTES_UPDATE: 'student_notes:update',
  STUDENT_NOTES_DELETE: 'student_notes:delete',

  // Departments
  DEPARTMENTS_READ: 'departments:read',
  DEPARTMENTS_CREATE: 'departments:create',
  DEPARTMENTS_UPDATE: 'departments:update',
  DEPARTMENTS_DELETE: 'departments:delete',

  // Designations
  DESIGNATIONS_READ: 'designations:read',
  DESIGNATIONS_CREATE: 'designations:create',
  DESIGNATIONS_UPDATE: 'designations:update',
  DESIGNATIONS_DELETE: 'designations:delete',

  // Employees
  EMPLOYEES_READ: 'employees:read',
  EMPLOYEES_CREATE: 'employees:create',
  EMPLOYEES_UPDATE: 'employees:update',
  EMPLOYEES_DELETE: 'employees:delete',

  // Guardians
  GUARDIANS_READ: 'guardians:read',
  GUARDIANS_CREATE: 'guardians:create',
  GUARDIANS_UPDATE: 'guardians:update',
  GUARDIANS_DELETE: 'guardians:delete',

  // Stakeholders
  STAKEHOLDERS_READ: 'stakeholders:read',
  STAKEHOLDERS_CREATE: 'stakeholders:create',
  STAKEHOLDERS_UPDATE: 'stakeholders:update',
  STAKEHOLDERS_DELETE: 'stakeholders:delete',

  // Academic years
  ACADEMIC_YEARS_READ: 'academic_years:read',
  ACADEMIC_YEARS_CREATE: 'academic_years:create',
  ACADEMIC_YEARS_UPDATE: 'academic_years:update',
  ACADEMIC_YEARS_DELETE: 'academic_years:delete',

  // Classes (incl. class-section assignments)
  CLASSES_READ: 'classes:read',
  CLASSES_CREATE: 'classes:create',
  CLASSES_UPDATE: 'classes:update',
  CLASSES_DELETE: 'classes:delete',

  // Sections
  SECTIONS_READ: 'sections:read',
  SECTIONS_CREATE: 'sections:create',
  SECTIONS_UPDATE: 'sections:update',
  SECTIONS_DELETE: 'sections:delete',

  // Subjects
  SUBJECTS_READ: 'subjects:read',
  SUBJECTS_CREATE: 'subjects:create',
  SUBJECTS_UPDATE: 'subjects:update',
  SUBJECTS_DELETE: 'subjects:delete',

  // Subject groups
  SUBJECT_GROUPS_READ: 'subject_groups:read',
  SUBJECT_GROUPS_CREATE: 'subject_groups:create',
  SUBJECT_GROUPS_UPDATE: 'subject_groups:update',
  SUBJECT_GROUPS_DELETE: 'subject_groups:delete',

  // Class subjects (per-class+year subject offerings)
  CLASS_SUBJECTS_READ: 'class_subjects:read',
  CLASS_SUBJECTS_CREATE: 'class_subjects:create',
  CLASS_SUBJECTS_UPDATE: 'class_subjects:update',
  CLASS_SUBJECTS_DELETE: 'class_subjects:delete',

  // Class subject groups (per-class+year group availability)
  CLASS_SUBJECT_GROUPS_READ: 'class_subject_groups:read',
  CLASS_SUBJECT_GROUPS_CREATE: 'class_subject_groups:create',
  CLASS_SUBJECT_GROUPS_UPDATE: 'class_subject_groups:update',
  CLASS_SUBJECT_GROUPS_DELETE: 'class_subject_groups:delete',

  // Student enrollments
  ENROLLMENTS_READ: 'enrollments:read',
  ENROLLMENTS_CREATE: 'enrollments:create',
  ENROLLMENTS_UPDATE: 'enrollments:update',
  ENROLLMENTS_DELETE: 'enrollments:delete',

  // Student subject selections
  STUDENT_SUBJECTS_READ: 'student_subjects:read',
  STUDENT_SUBJECTS_CREATE: 'student_subjects:create',
  STUDENT_SUBJECTS_UPDATE: 'student_subjects:update',
  STUDENT_SUBJECTS_DELETE: 'student_subjects:delete',

  // Class teachers
  CLASS_TEACHERS_READ: 'class_teachers:read',
  CLASS_TEACHERS_CREATE: 'class_teachers:create',
  CLASS_TEACHERS_UPDATE: 'class_teachers:update',
  CLASS_TEACHERS_DELETE: 'class_teachers:delete',

  // Subject teachers
  SUBJECT_TEACHERS_READ: 'subject_teachers:read',
  SUBJECT_TEACHERS_CREATE: 'subject_teachers:create',
  SUBJECT_TEACHERS_UPDATE: 'subject_teachers:update',
  SUBJECT_TEACHERS_DELETE: 'subject_teachers:delete',

  // Periods
  PERIODS_READ: 'periods:read',
  PERIODS_CREATE: 'periods:create',
  PERIODS_UPDATE: 'periods:update',
  PERIODS_DELETE: 'periods:delete',

  // Timetables
  TIMETABLES_READ: 'timetables:read',
  TIMETABLES_CREATE: 'timetables:create',
  TIMETABLES_UPDATE: 'timetables:update',
  TIMETABLES_DELETE: 'timetables:delete',

  // Student promotions
  PROMOTIONS_READ: 'promotions:read',
  PROMOTIONS_CREATE: 'promotions:create',
  PROMOTIONS_UPDATE: 'promotions:update',
  PROMOTIONS_DELETE: 'promotions:delete',

  // Cats
  CATS_READ: 'cats:read',
  CATS_CREATE: 'cats:create',
  CATS_UPDATE: 'cats:update',
  CATS_DELETE: 'cats:delete',

  // Tasks
  TASKS_READ: 'tasks:read',
  TASKS_CREATE: 'tasks:create',
  TASKS_UPDATE: 'tasks:update',
  TASKS_DELETE: 'tasks:delete',

  // Products
  PRODUCTS_READ: 'products:read',
  PRODUCTS_CREATE: 'products:create',
  PRODUCTS_UPDATE: 'products:update',
  PRODUCTS_DELETE: 'products:delete',

  // Access control management
  ROLES_READ: 'roles:read',
  ROLES_MANAGE: 'roles:manage',
  ROLES_ASSIGN: 'roles:assign',
} as const;
```

That is 27 CRUD resources (4 keys each) plus the 3 `roles:*` keys, 111 keys in total.

Helpers exported alongside the catalog:
- `PermissionKey` — union type of every key
- `ALL_PERMISSIONS` — array of every key (used to seed the `admin` role)
- `PERMISSION_SET: ReadonlySet<string>` — O(1) validation set used by `RoleService.validatePermissions`
- `getPermissionCatalog(): PermissionGroup[]` — groups keys by resource for the `GET /permissions` response

### 2.2 System Roles

**File:** `system-roles.seed.ts` — eight roles (`SYSTEM_ROLES`) seeded for every organization on creation. System roles carry `isSystem = true`: they **cannot be renamed or deleted**, but their permission lists **can** be edited via `PATCH /roles/:id` or `PUT /roles/:id/permissions`.

| Role | Description | Permissions |
|---|---|---|
| `admin` | Full tenant administrator | `ALL_PERMISSIONS` |
| `staff` | General school staff | `users:read`; all four actions on `students`, `student_documents`, `student_medical`, `student_notes`, `employees`, `guardians`, `stakeholders`, `academic_years`, `classes`, `sections`, `subjects`, `subject_groups`, `class_subjects`, `class_subject_groups`, `enrollments`, `student_subjects`, `class_teachers`, `subject_teachers`, `periods`, `timetables`, `promotions`, `cats`, `tasks`; read only on `departments`, `designations`, `products` |
| `teacher` | Teaching staff | `users:read`, `students:read`, `student_documents:read`, `student_notes:read`, `departments:read`, `designations:read`, `employees:read`, `guardians:read`, `academic_years:read`, `classes:read`, `sections:read`, `subjects:read`, `subject_groups:read`, `class_subjects:read`, `class_subject_groups:read`, `enrollments:read`, `student_subjects:read`, `class_teachers:read`, `subject_teachers:read`, `periods:read`, `timetables:read`, `promotions:read`, `tasks:read`, `tasks:create`, `tasks:update`, `cats:read`, `products:read` |
| `accountant` | Finance and inventory | `users:read`, `students:read`, `departments:read`, `designations:read`, `employees:read`, all `products:*` |
| `librarian` | Library management | `users:read`, `students:read`, `departments:read`, `designations:read`, `employees:read`, all `cats:*`, `products:read` |
| `parent` | Parent or guardian | `students:read`, `tasks:read`, `products:read` |
| `student` | Student | `tasks:read` |
| `stakeholder` | External member or stakeholder | none (`[]`) |

No system role other than `admin` holds `users:create|update|delete` or any `roles:*` key.

Also exported: `ADMIN_ROLE_NAME = 'admin'` (used by `RoleService.unassignRole` for the last-admin safeguard and by `OwnerProvisioningService` to grant the owner the admin role) and `SYSTEM_ROLE_NAMES: ReadonlySet<string>`.

### 2.3 Entities

Both entities extend `OrgScopedEntity` (`tenancy/org-scoped.entity.ts`), which adds an indexed `org_id uuid NOT NULL` column with a CASCADE FK to `organizations`. Both are RLS-protected.

#### `Role` — table `public.roles`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | Auto-generated |
| `org_id` | uuid | FK → `organizations(id)`, CASCADE DELETE | From `OrgScopedEntity` |
| `name` | varchar | Not Null | Case-sensitive |
| `description` | varchar(255) | Nullable | Free text |
| `permissions` | text[] | Not Null, default `{}` | Keys from the catalog |
| `is_system` | boolean | Not Null, default `false` | System roles cannot be deleted or renamed |
| `created_at` | timestamp | Not Null | Auto-set |
| `updated_at` | timestamp | Not Null | Auto-updated |

Index: `uq_roles_org_name` — unique on `(org_id, name)`; role names are unique per organization.
Relation: `userRoles` — OneToMany → `UserRole`.

#### `UserRole` — table `public.user_roles`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | Auto-generated |
| `org_id` | uuid | FK → `organizations(id)`, CASCADE DELETE | From `OrgScopedEntity` |
| `user_id` | uuid | FK → `users(id)`, **CASCADE DELETE** | Global user; membership is checked in `RoleService.assignRole` |
| `role_id` | uuid | FK → `roles(id)`, **CASCADE DELETE** | |
| `created_at` | timestamp | Not Null | Auto-set |

Index: `uq_user_roles_user_role` — unique on `(org_id, user_id, role_id)`.

Relations: `user` — ManyToOne → `User`; `role` — ManyToOne → `Role`.

### 2.4 DTOs

**`CreateRoleDto`**

| Field | Validation | Required |
|---|---|---|
| `name` | string, MinLength(2), MaxLength(64) | Yes |
| `description` | string, MaxLength(255) | No |
| `permissions` | IsArray, each IsString | No — defaults to `[]`; validated against `PERMISSION_SET` in the service |

**`UpdateRoleDto`** — all fields optional; renaming a system role → 403.

| Field | Validation |
|---|---|
| `name` | string, MinLength(2), MaxLength(64) |
| `description` | string, MaxLength(255) |
| `permissions` | IsArray, each IsString — replaces the existing list |

**`SetPermissionsDto`** (body of `PUT /roles/:id/permissions`)

| Field | Validation |
|---|---|
| `permissions` | IsArray, each IsString — validated against the catalog |

**`AssignRoleDto`** (body of `POST /users/:userId/roles`)

| Field | Validation |
|---|---|
| `roleId` | IsUUID |

### 2.5 Repositories

| Repository | Methods |
|---|---|
| `RoleRepository` | Base methods + `findByName(name)` |
| `UserRoleRepository` | `findByUserId(userId)` (loads `role`), `findByUserIds(userIds)` (loads `role`), `findByRoleId(roleId)`, `findAssignment(userId, roleId)`, `countByRoleId(roleId)`, `assign(userId, roleId)` (idempotent), `unassign(userId, roleId)`, `unassignAll(userId)` |

Both extend `BaseTenantRepository`, so every call is pinned to the request's org.

### 2.6 Services

#### `RoleService`

| Method | Signature | Description |
|---|---|---|
| `findAll` | `(): Promise<Role[]>` | All roles of the org, ordered by `name` ASC |
| `findById` | `(id: string): Promise<Role>` | `404 Role with id "<id>" not found` if absent |
| `create` | `(dto: CreateRoleDto): Promise<Role>` | `409` on duplicate name; validates permission keys; `isSystem = false` |
| `update` | `(id: string, dto: UpdateRoleDto): Promise<Role>` | `403` when renaming a system role; `409` on name clash; replaces description / permissions when sent |
| `setPermissions` | `(id: string, permissions: string[]): Promise<Role>` | Replaces the role's permission list |
| `remove` | `(id: string, force = false): Promise<void>` | `403` on system role; `409` if assigned to users unless `force`; assignments go via the `user_roles.role_id` CASCADE FK |
| `getUserRoles` | `(userId: string): Promise<Role[]>` | Roles assigned to the user in this org (drops assignments whose role failed to load) |
| `assignRole` | `(userId: string, roleId: string): Promise<void>` | `404` if the role does not exist or the user is not a member of this org; idempotent |
| `unassignRole` | `(userId: string, roleId: string): Promise<void>` | `404` if the role does not exist; for the `admin` role, `409` unless some **other** user still holds it; deleting a missing assignment is a no-op |
| `validatePermissions` *(private)* | `(permissions: string[]): string[]` | De-duplicates and rejects unknown keys (`400`) |

#### `PermissionResolverService`

| Method | Signature | Description |
|---|---|---|
| `getEffectivePermissions` | `(userId: string): Promise<Set<string>>` | Loads the user's `UserRole`s in this org (with `role`) and returns the **union** of their `permissions` |
| `getRoles` | `(userId: string): Promise<Role[]>` | The role objects only |

Permissions are resolved **fresh per request** through the request-scoped tenant connection, so role and assignment changes take effect on the next request. The `isAdmin` bypass, in contrast, comes from the JWT (see 3.3).

#### `RbacSeederService`

| Method | Signature | Description |
|---|---|---|
| `seedSystemRoles` | `(manager: EntityManager, orgId: string): Promise<void>` | For each `SYSTEM_ROLES` entry, inserts it for `orgId` with `isSystem = true` unless a role with that name already exists. Idempotent. Runs on the caller's `EntityManager` (the owner connection inside the org-creation transaction), so RLS does not apply. |

Called from `OrganizationService.createOrganization` (platform side) inside the same transaction that inserts the organization.

#### `OwnerProvisioningService`

Lives in `modules/auth/services/owner-provisioning.service.ts` but is provided and exported by `RbacModule`.

| Method | Signature | Description |
|---|---|---|
| `provisionOwner` | `(manager: EntityManager, { orgId, userId }): Promise<{ token: string }>` | Upserts the membership with `role = owner`, `isAdmin = true` (new memberships start `pending`); assigns the org's `admin` role if it exists; saves a 7-day `activation` token (`auth_tokens`, `org_id` set, only the sha256 hash stored). Idempotent. |
| `sendActivationEmail` | `(recipient: { email, name }, orgSlug: string, token: string): Promise<void>` | Sends the activation link; called after commit |

Callers: `OrganizationService` (create, transfer ownership, resend owner activation) and `MembershipService.create` (when creating an `owner` membership).

### 2.7 Controllers

All three use `@UseGuards(JwtAuthGuard, PermissionsGuard)` at the controller level, `@ApiBearerAuth('tenant-jwt')` and `@ApiHeader({ name: 'x-tenant-id' })`.

#### `RoleController` at prefix `roles`

| Method | Path | Decorator | Description |
|---|---|---|---|
| GET | `/roles` | `@RequirePermissions(ROLES_READ)` | List roles |
| GET | `/roles/:id` | `@RequirePermissions(ROLES_READ)` | Get role by id |
| POST | `/roles` | `@RequirePermissions(ROLES_MANAGE)` | Create a custom role |
| PATCH | `/roles/:id` | `@RequirePermissions(ROLES_MANAGE)` | Update name / description / permissions |
| PUT | `/roles/:id/permissions` | `@RequirePermissions(ROLES_MANAGE)` | Replace the permission list (`SetPermissionsDto`) |
| DELETE | `/roles/:id` | `@RequirePermissions(ROLES_MANAGE)` | Delete; `?force=true` also removes assignments; returns `204` |

Note: `RoleController` returns the raw `Role` / `Role[]` value, **not** the `{ success, statusCode, message, data }` envelope.

#### `UserRoleController` at prefix `users/:userId/roles`

| Method | Path | Decorator | Description |
|---|---|---|---|
| GET | `/users/:userId/roles` | `@RequirePermissions(ROLES_READ)` | Roles assigned to the user (envelope, `data: Role[]`) |
| POST | `/users/:userId/roles` | `@RequirePermissions(ROLES_ASSIGN)` | Assign a role (`AssignRoleDto`); idempotent; envelope without `data` |
| DELETE | `/users/:userId/roles/:roleId` | `@RequirePermissions(ROLES_ASSIGN)` | Unassign; refuses to remove the last `admin` assignment |

#### `PermissionController` at prefix `permissions`

| Method | Path | Decorator | Description |
|---|---|---|---|
| GET | `/permissions` | `@RequirePermissions(ROLES_READ)` | Raw (un-enveloped) catalog grouped by resource: `[{ resource, permissions: [{ key, action }] }]` |

### 2.8 Guards & Decorators

| Artifact | File | Purpose |
|---|---|---|
| `JwtAuthGuard` | `modules/auth/guards/jwt-auth.guard.ts` | `AuthGuard('jwt')`; runs `JwtStrategy`, populates `request.user` |
| `PermissionsGuard` | `modules/rbac/permissions.guard.ts` | Reads `Key.Permissions` metadata (handler, then class). No metadata → allow. No `request.user.userId` → `401 Authentication required`. `request.user.isAdmin` → allow. Else allow when the effective set contains **at least one** required key, otherwise `403 Missing required permission: A or B` |
| `IsAdminGuard` | `modules/rbac/is-admin.guard.ts` | `403 Admin only` unless `request.user.isAdmin === true` |
| `@RequirePermissions(...keys)` | `modules/rbac/require-permissions.decorator.ts` | `SetMetadata(Key.Permissions, keys)`; **OR semantics** across keys |

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

Adding a feature means adding catalog keys and, if system roles should get them, updating `system-roles.seed.ts`. The seeder only inserts missing roles, so existing organizations do not pick up new keys on their seeded roles automatically.

---

## 3. Tenant Authentication

**Location:** `modules/auth/` (tenant pieces: `controllers/auth.controller.ts`, `services/auth.service.ts`, `strategies/jwt.strategy.ts`, `guards/jwt-auth.guard.ts`, `repositories/auth-token.repository.ts`). Platform pieces (`PlatformAuthController` on `/platform/auth`, `PlatformJwtStrategy`) share the module and the JWT signing config.

### 3.1 Endpoints

Route prefix: `auth`. Every request must resolve an organization (header, subdomain or custom domain). Handlers marked *throttled* use `@Throttle(AUTH_THROTTLE)` (5 requests / 60 s per tracked client).

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/auth/activate?token=` | Public | Validate an activation token → `{ email, name, organization }` |
| POST | `/auth/activate` | Public, throttled | `{ token, password (min 6) }`: set the account password, mark the email verified, flip a `pending` account to `active`, set the membership `active`, consume the token, and return a login response |
| POST | `/auth/login` | Public, throttled | `{ email, password }` → login response |
| POST | `/auth/forgot-password` | Public, throttled | `{ email }`; always returns the generic message; emails a 1-hour reset token only if the account is a member of this org |
| GET | `/auth/reset-password?token=` | Public | Pre-check a reset token → `{ email }` |
| POST | `/auth/reset-password` | Public, throttled | `{ token, password (min 6) }`; sets the **global** password |
| GET | `/auth/verify-email?token=` | Public | Pre-check a verification token → `{ email }` |
| POST | `/auth/verify-email` | Public, throttled | `{ token }` → `{ email, emailVerifiedAt }` |
| POST | `/auth/resend-verification` | Public, throttled | `{ email }`; generic message; sends a 24-hour token if the member is unverified |
| POST | `/auth/change-password` | `JwtAuthGuard` | `{ currentPassword, newPassword (min 6) }`; changes the **global** password |
| GET | `/auth/me` | `JwtAuthGuard` | Current account + membership + role names |

There is **no** tenant `/auth/register`: accounts are created by the platform (`/platform/auth/register`, `/platform/users`) or by `POST /users`, and school owners arrive through the activation flow.

Tokens are looked up through `AuthTokenRepository`, which is org-scoped: only tokens whose `org_id` matches the request's org are found, so platform-issued tokens (`org_id` null) and other schools' tokens cannot be redeemed here. Tokens are matched by sha256 hash **and** type, and are single-use (`used_at`) and time-limited (`expires_at`).

### 3.2 Request / Response Shapes

**Login / activate response (`data` field of the envelope):**

```json
{
  "access_token": "<jwt>",
  "token_type": "Bearer",
  "user": {
    "id": "<uuid>",
    "email": "user@example.com",
    "name": "Jane Doe",
    "roles": ["staff", "teacher"],
    "status": "active",
    "isAdmin": false
  },
  "organization": {
    "id": "<uuid>",
    "slug": "acme"
  }
}
```

`user.status` and `user.isAdmin` come from the membership in this org.

**`GET /auth/me` (`data`):** the account columns (without `password`) plus `status` (membership status), `isAdmin` (membership flag, overriding the account's platform flag), `membershipId` and `roles` (role names).

**Login checks, in order:**
1. Account exists, has a password, and the password matches → else `401 Invalid credentials`.
2. Account has a membership in this org → else `401 Invalid credentials` (does not reveal which schools an email belongs to).
3. Account status is not `suspended` / `deactivated` / `banned` → else `401 Account is <status>`. (`pending` accounts are allowed.)
4. Membership status: `pending` → `403 Please activate your account using the link sent to your email.`; anything other than `active` → `401 Membership is <status>`.

### 3.3 JWT Payload

```json
{
  "sub": "<userId>",
  "email": "user@example.com",
  "orgId": "<organizationId>",
  "isAdmin": true,
  "iat": 1700000000,
  "exp": 1700086400
}
```

Type: `TenantJwtPayload` in `strategies/jwt.strategy.ts`. Expiry comes from `jwt.expiresIn` (`JWT_EXPIRES_IN`, default `1d`). Both realms sign with the same `jwt.secret`; they are told apart by the `orgId` claim:

- `JwtStrategy` (`'jwt'`, tenant) rejects any token whose `orgId` is missing or differs from `req.orgId` → `401 Token does not belong to this organization`. This blocks platform tokens and tokens from another school, including their `isAdmin` bypass.
- `PlatformJwtStrategy` (`'platform-jwt'`) rejects any token that carries `orgId`.

`JwtStrategy.validate()` returns the request user as:

```ts
{ userId, email, orgId, isAdmin }
```

`isAdmin` is a snapshot of `memberships.is_admin` at sign-in. `grant-admin` / `revoke-admin` take effect only once the member gets a new token. Likewise, `JwtStrategy` does not re-check membership or account status, so a suspended or removed member keeps API access until the token expires.

### 3.4 Tenant Resolution

**File:** `tenancy/tenant.middleware.ts` (applied to every route except the `.exclude(...)` list in `app.module.ts`: `/`, `/info`, `health`, `organizations`, `memberships`, `platform/auth`, `platform/users`, `public`, `dev/mail`).

1. If the `x-tenant-id` header is present, look up the org by that slug. An invalid slug pattern (`/^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$/`) or an unknown slug → `TenantNotFoundException` (404).
2. Otherwise take the first host label; unless it is `www` or `api`, look it up as a slug. A miss falls through.
3. Otherwise look up the full host as a custom domain (`organizations.domain`).
4. Nothing resolved → `TenantContextMissingException` (400). This includes an unknown subdomain.
5. `status !== active` → `TenantInactiveException` (403).
6. Set `req.orgId` and `req.orgSlug` (`RequestWithOrg`).

Slug and domain lookups are cached in memory for 60 s (`tenant-slug.cache.ts`); `OrganizationService` invalidates the entries when an org is updated or deleted.

### 3.5 Tenant connection and cleanup

**Files:** `tenancy/tenancy.module.ts`, `tenant-connection.service.ts`, `tenant-datasource.proxy.ts`, `tenant-cleanup.interceptor.ts`, `base-tenant.repository.ts`.

- `TENANT_POOL_DATASOURCE` is a second DataSource over the same `public` schema that connects as `DB_APP_USERNAME` (falls back to the owner credentials, with a warning, when unset; RLS then does not apply). In non-production, startup first runs `ensureAppRole` (creates the role `LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE` if missing) and `applyRowLevelSecurity` (policies + DML grants) on the root connection.
- `TENANT_DATASOURCE` is **request-scoped**. Its factory throws `TenantContextMissingException` if `req.orgId` is unset, otherwise calls `TenantConnectionService.getScopedConnection(orgId)`: take a QueryRunner from the pool, run `SELECT set_config('app.org_id', <orgId>, false)`, wrap it in a `TenantDataSourceProxy` (`getRepository()`, `getManager()` for transactions, `orgId`, `release()`), and attach it to the request.
- `BaseTenantRepository<T>` takes the proxy, exposes `this.orgId`, and wraps `this.repo` with `scopeRepository` when the entity has an `orgId` property.
- The global `TenantCleanupInterceptor` calls `proxy.release()` (`RESET app.org_id`, then release the QueryRunner) when the response finishes or errors.

Because `TENANT_DATASOURCE` is request-scoped, every repository, service, guard and controller that depends on it is request-scoped too (including `PermissionsGuard`, through `PermissionResolverService` → `UserRoleRepository`).

---

## 4. Module Dependency Graph

```
AppModule
├── TenancyModule (@Global) ── exports TenantConnectionService, TENANT_DATASOURCE
│
├── AuthModule
│   ├── TypeOrmModule.forFeature([User, AuthToken])
│   ├── PassportModule
│   ├── JwtModule.registerAsync(...)   (jwt.secret, jwt.expiresIn)
│   ├── UserModule        (AccountRepository)
│   └── RbacModule        (MemberRepository, UserRoleRepository for role names)
│   providers: AuthService, JwtStrategy, AuthTokenRepository,
│              PlatformAuthService, PlatformJwtStrategy
│
├── UserModule
│   ├── TypeOrmModule.forFeature([User])
│   └── RbacModule        (RoleRepository, UserRoleRepository, MemberRepository)
│   providers: UserService, OrgUserService, AccountRepository
│
├── RbacModule  ── providers & exports:
│       RoleService, RoleRepository, UserRoleRepository, MemberRepository,
│       PermissionResolverService, PermissionsGuard, IsAdminGuard,
│       RbacSeederService, OwnerProvisioningService
│
├── OrganizationModule  (imports UserModule, RbacModule)
└── MembershipModule    (imports UserModule, RbacModule)
```

External callers of `RbacSeederService` / `OwnerProvisioningService`: `OrganizationService.createOrganization()` runs `seedSystemRoles(manager, orgId)` and, when there is an owner, `provisionOwner(manager, { orgId, userId })` in one transaction on the root DataSource, then sends the activation email after commit. Any module that uses `PermissionsGuard` must import `RbacModule`.

---

## 5. Authorization Matrix

`A` = School admin (`isAdmin = true` in the token); permission columns assume `isAdmin = false`.

| Action | School Admin | Holder of relevant permission | No permission | Unauthenticated |
|---|---|---|---|---|
| Activate account (`/auth/activate`) | — | — | — | Yes (with token) |
| Log in | A | Yes | Yes | Yes (public) |
| Forgot / reset password, verify email | — | — | — | Yes (public) |
| Change own password (`POST /auth/change-password`) | A | Yes | Yes | No |
| View own profile (`GET /auth/me`) | A | Yes | Yes | No |
| List members (`GET /users`) | A | `users:read` | No | No |
| Add member (`POST /users`) | A | `users:create` | No | No |
| Update member (`PATCH /users/:id`) | A | `users:update` | No | No |
| Remove member (`DELETE /users/:id`) | A | `users:delete` | No | No |
| Grant / revoke school admin | A | No (admin-only) | No | No |
| List / view roles | A | `roles:read` | No | No |
| Create / update / delete role | A | `roles:manage` | No | No |
| Replace role permissions | A | `roles:manage` | No | No |
| List a user's role assignments | A | `roles:read` | No | No |
| Assign / unassign role | A | `roles:assign` | No | No |
| View permission catalog | A | `roles:read` | No | No |
| Feature CRUD (students, employees, classes, … cats / tasks / products) | A | matching `<resource>:<action>` key | No | No |

Notes:
- OR semantics: `@RequirePermissions(A, B)` accepts a user holding **either** A or B.
- The `admin` role holds `ALL_PERMISSIONS`, so a member with only the `admin` role has full `@RequirePermissions` coverage even **without** `isAdmin`, but cannot use `IsAdminGuard` routes. Owners provisioned by `OwnerProvisioningService` get both.

---

## 6. Error Reference

| Scenario | Exception | HTTP | Message |
|---|---|---|---|
| Bad email/password, or valid credentials but no membership in this org | `UnauthorizedException` | 401 | `Invalid credentials` |
| Account `suspended` / `deactivated` / `banned` at login | `UnauthorizedException` | 401 | `Account is <status>` |
| Membership `pending` at login | `ForbiddenException` | 403 | `Please activate your account using the link sent to your email.` |
| Membership `suspended` / `deactivated` at login | `UnauthorizedException` | 401 | `Membership is <status>` |
| Activation / reset / verification token unknown, used or expired | `BadRequestException` | 400 | `Invalid or expired <activation\|reset\|verification> link` |
| Token's user missing, or activation for a non-member | `BadRequestException` | 400 | `Invalid <label> link` / `Invalid activation link` |
| Wrong current password on change-password | `BadRequestException` | 400 | `Current password is incorrect` |
| `getMe` / change-password user not found | `UnauthorizedException` | 401 | `User not found` |
| Token issued for another org, or without `orgId` | `UnauthorizedException` | 401 | `Token does not belong to this organization` |
| Adding an existing member | `ConflictException` | 409 | `User is already a member of this organization` |
| Member not found (users endpoints, role assignment) | `NotFoundException` | 404 | `User with id "<id>" not found` |
| Role not found | `NotFoundException` | 404 | `Role with id "<id>" not found` |
| Duplicate role name | `ConflictException` | 409 | `Role "<name>" already exists` |
| Unknown permission key | `BadRequestException` | 400 | `Unknown permission(s): <list>` |
| Renaming a system role | `ForbiddenException` | 403 | `System roles cannot be renamed` |
| Deleting a system role | `ForbiddenException` | 403 | `System roles cannot be deleted` |
| Deleting an assigned role without `?force=true` | `ConflictException` | 409 | `Role is assigned to N user(s). Pass ?force=true to delete it and remove those assignments.` |
| Removing the last `admin` role assignment | `ConflictException` | 409 | `Cannot remove the last admin role assignment` |
| Missing every required permission | `ForbiddenException` | 403 | `Missing required permission: X or Y` |
| `PermissionsGuard` without an authenticated user | `UnauthorizedException` | 401 | `Authentication required` |
| Non-admin on an `IsAdminGuard` route | `ForbiddenException` | 403 | `Admin only` |
| Repository write naming another org | `ForbiddenException` | 403 | `Cross-organization write blocked` |
| No header and neither subdomain nor domain resolves | `TenantContextMissingException` | 400 | `Tenant context is required for this route. Provide the x-tenant-id header or use a tenant subdomain.` |
| `x-tenant-id` slug invalid or unknown | `TenantNotFoundException` | 404 | `Tenant "<slug>" not found` |
| Organization status `!== active` | `TenantInactiveException` | 403 | `Tenant "<slug>" is not active` |
| Invalid / missing / expired JWT | `UnauthorizedException` (Passport) | 401 | — |
| DTO validation failure or unknown body field | `BadRequestException` (ValidationPipe) | 400 | — |
| Throttle limit exceeded | `ThrottlerException` | 429 | — |

---

## 7. End-to-End Example

**Bootstrap a school and grant a custom role.**

```
1. Platform side: a platform user creates organization "acme"
   (POST /api/organizations, platform JWT; excluded from TenantMiddleware).
   - OrganizationService.createOrganization, in one transaction on the root DataSource:
       insert the organizations row,
       RbacSeederService.seedSystemRoles(manager, org.id)  → 8 roles with org_id = org.id,
       OwnerProvisioningService.provisionOwner(manager, { orgId, userId })
         → membership (role owner, isAdmin true, status pending),
           user_roles row for the "admin" role,
           auth_tokens row (type activation, org_id = org.id).
   - After commit: activation email with a link carrying the slug.

2. Tenant side: the owner activates.
   POST /api/auth/activate   (x-tenant-id: acme)
   { token, password }
   → password set, email verified, membership active, token consumed
   → JWT { sub, email, orgId: <acme id>, isAdmin: true }.

3. The owner creates a custom role.
   POST /api/roles   @RequirePermissions(ROLES_MANAGE), bypassed by isAdmin
   { name: "reviewer", description: "...",
     permissions: ["students:read", "tasks:read"] }
   → RoleRepository stamps org_id; RLS WITH CHECK confirms it.

4. The owner adds user B and assigns the role.
   POST /api/users   { name, email, password }          → membership (active)
   POST /api/users/<userId-B>/roles  { roleId: "<reviewer-id>" }

5. User B logs in at acme and calls GET /api/students.
   - TenantMiddleware: req.orgId = <acme id>.
   - JwtAuthGuard: token orgId matches; isAdmin = false.
   - PermissionsGuard: effective permissions in acme = { "students:read", "tasks:read" }
     → allowed. Queries see only acme rows (scopeRepository + RLS).

6. The same user calls POST /api/students.
   - Effective set lacks "students:create" → 403
     "Missing required permission: students:create".

7. User B sends the acme token to another school (x-tenant-id: beta).
   - JwtStrategy: payload.orgId !== req.orgId → 401
     "Token does not belong to this organization".
```
