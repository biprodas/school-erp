# Platform Admin Module

Technical documentation for the three public-schema modules that power platform-level administration: **Users**, **Tenants**, and **Memberships**. Authentication for this layer is covered in a separate section at the end.

All paths are relative to `backend/src/`.

---

## Overview

The platform admin layer operates on the shared `public` PostgreSQL schema. It is distinct from the per-tenant schemas and handles identity, tenancy lifecycle, and the many-to-many relationship that binds users to tenants.

```
public.users  ──<  public.memberships  >──  public.tenants
```

Every platform request is authenticated with a **platform JWT** (strategy name `platform-jwt`). Role-based access control uses two platform roles:

| PlatformRole | Description |
|---|---|
| `super_admin` | Full access to all resources across all tenants |
| `user` | Access restricted to owned/member tenants |

---

## 1. Users Module

**Location:** `modules/public/users/`

### 1.1 Entity — `User`

Database table: `public.users`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | Auto-generated |
| `email` | varchar | Unique, Not Null | Login identifier |
| `password` | varchar | Not Null, `select: false` | bcrypt-hashed (10 rounds) |
| `firstName` | varchar | Not Null | |
| `lastName` | varchar | Not Null | |
| `fullName` | varchar | | Synced automatically via `@AfterLoad`, `@AfterInsert`, `@AfterUpdate` hooks |
| `role` | enum | Not Null, default `user` | `super_admin` \| `user` |
| `isActive` | boolean | Not Null, default `true` | Soft-disable without deletion |
| `createdAt` | timestamp | Not Null | Auto-set |
| `updatedAt` | timestamp | Not Null | Auto-updated |

Relations:
- `memberships` — OneToMany → `Membership`

The computed `fullName` column and the `name` getter both join `firstName + ' ' + lastName`. `fullName` is persisted to the database; `name` is a transient accessor.

### 1.2 Enums

```ts
// modules/public/users/enums/platform-role.enum.ts
enum PlatformRole {
  SUPER_ADMIN = 'super_admin',
  USER        = 'user',
}
```

### 1.3 DTOs

**`CreatePlatformUserDto`**

| Field | Validation | Required |
|---|---|---|
| `firstName` | string | Yes |
| `lastName` | string | Yes |
| `email` | IsEmail | Yes |
| `password` | string, MinLength(6) | Yes |
| `role` | IsEnum(PlatformRole) | No — defaults to `user` |
| `isActive` | IsBoolean | No — defaults to `true` |

**`UpdateUserDto`**

All fields optional. Non-admin callers have `role` and `isActive` stripped server-side regardless of what is sent.

| Field | Validation |
|---|---|
| `firstName` | string |
| `lastName` | string |
| `role` | IsEnum(PlatformRole) |
| `isActive` | IsBoolean |

### 1.4 Service — `UserService`

| Method | Signature | Description |
|---|---|---|
| `findAll` | `(): Promise<User[]>` | Returns all users |
| `createPlatformUser` | `(dto): Promise<User>` | Hashes password; throws `ConflictException` on duplicate email |
| `findById` | `(id: string): Promise<User>` | Throws `NotFoundException` if absent |
| `update` | `(requesterId, requesterRole, targetId, dto)` | Self-update allowed; only `SUPER_ADMIN` can change `role`/`isActive` |
| `remove` | `(id: string): Promise<void>` | Hard delete |

### 1.5 Controller — `UserController`

Route prefix: `platform/users`
Global guard: `PlatformJwtAuthGuard`

| Method | Path | Guard / Decorator | Description |
|---|---|---|---|
| GET | `/` | `@Roles(SUPER_ADMIN)` | List all users |
| POST | `/` | `@Roles(SUPER_ADMIN)` | Create user |
| GET | `/:id` | — | Get user (self or SUPER_ADMIN) |
| PATCH | `/:id` | — | Update user (enforced in service) |
| DELETE | `/:id` | `@Roles(SUPER_ADMIN)` | Delete user |

---

## 2. Tenants Module

**Location:** `modules/public/tenants/`

### 2.1 Entity — `Tenant`

Database table: `public.tenants`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | Auto-generated |
| `name` | varchar | Unique, Not Null | Human-friendly display name (e.g., `"Acme Secondary School"`) |
| `slug` | varchar | Unique, Not Null | URL-safe identifier, lowercase alphanumeric + underscores (e.g., `"001_acme"`) |
| `schemaName` | varchar | Unique, Not Null | PostgreSQL schema identifier, generated as `tenant_<slug>` |
| `domain` | varchar | Unique, Nullable | Optional custom FQDN (e.g., `"acme.myapp.com"`) |
| `status` | enum | Not Null, default `active` | See TenantStatus below |
| `createdAt` | timestamp | Not Null | Auto-set |
| `updatedAt` | timestamp | Not Null | Auto-updated |

Relations:
- `memberships` — OneToMany → `Membership`

### 2.2 Enums

```ts
// modules/public/tenants/enums/tenant-status.enum.ts
enum TenantStatus {
  PENDING   = 'pending',
  ACTIVE    = 'active',
  INACTIVE  = 'inactive',
  SUSPENDED = 'suspended',
  ARCHIVED  = 'archived',
}
```

### 2.3 DTOs

**`CreateTenantDto`**

| Field | Validation | Required |
|---|---|---|
| `name` | string, Length(3, 100) | Yes |
| `slug` | string, Length(3, 63), Matches(`/^[a-z0-9_]+$/`) | Yes |
| `domain` | IsFQDN (no underscores, requires TLD) | No |

**`UpdateTenantDto`**

| Field | Validation | Required |
|---|---|---|
| `name` | string, Length(3, 100) | No |
| `domain` | IsFQDN | No |
| `status` | IsEnum(TenantStatus) | No |

> Note: `slug` and `schemaName` are immutable after creation.

### 2.4 Service — `TenantService`

| Method | Signature | Description |
|---|---|---|
| `createTenant` | `(dto, ownerId?): Promise<Tenant>` | Creates DB record, provisions PostgreSQL schema, runs tenant migrations, optionally creates OWNER membership |
| `getAllTenants` | `(): Promise<Tenant[]>` | Returns all tenants |
| `getTenantsByUser` | `(userId): Promise<Tenant[]>` | Returns tenants the user has any membership in |
| `findById` | `(id): Promise<Tenant \| null>` | Raw lookup |
| `findBySlug` | `(slug): Promise<Tenant \| null>` | Raw lookup |
| `findByIdForUser` | `(id, userId, role)` | Authorization-aware: `SUPER_ADMIN` sees all; others require membership |
| `updateTenant` | `(id, dto, requesterId, requesterRole)` | Only OWNER or SUPER_ADMIN; `status` changes allowed |
| `deleteTenant` | `(id): Promise<void>` | Drops PostgreSQL schema (`CASCADE`) then deletes record |

**Schema provisioning flow (on `createTenant`):**

```
1. Insert tenant record (slug → schemaName derived)
2. CREATE SCHEMA IF NOT EXISTS <schemaName>
3. Initialize separate TypeORM DataSource scoped to <schemaName>
4. Run synchronize() to apply tenant entity migrations
5. If ownerId provided → create Membership(userId=ownerId, role=OWNER)
```

### 2.5 Controller — `TenantController`

Route prefix: `tenants`
Global guard: `PlatformJwtAuthGuard`

| Method | Path | Auth rule | Description |
|---|---|---|---|
| GET | `/` | — | `SUPER_ADMIN` → all tenants; `user` → own memberships only |
| GET | `/:id` | — | Delegated to `findByIdForUser` |
| POST | `/` | — | Creates tenant; requester becomes OWNER (unless SUPER_ADMIN) |
| PATCH | `/:id` | — | Update; OWNER or SUPER_ADMIN only (enforced in service) |
| DELETE | `/:id` | `@Roles(SUPER_ADMIN)` | Destroy tenant and schema |

---

## 3. Memberships Module

**Location:** `modules/public/memberships/`

A membership is the join record that grants a platform user access to a tenant with a specific role.

### 3.1 Entity — `Membership`

Database table: `public.memberships`
Unique index: `(userId, tenantId)` — one membership per user per tenant.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | Auto-generated |
| `userId` | uuid | FK → `public.users(id)`, CASCADE DELETE | |
| `tenantId` | uuid | FK → `public.tenants(id)`, CASCADE DELETE | |
| `role` | enum | Not Null, default `member` | `owner` \| `admin` \| `member` |
| `createdAt` | timestamp | Not Null | Auto-set |
| `updatedAt` | timestamp | Not Null | Auto-updated |

Relations:
- `user` — ManyToOne → `User`
- `tenant` — ManyToOne → `Tenant`

Cascade behaviour: deleting a User or Tenant automatically removes all associated Memberships.

### 3.2 Enums

```ts
// modules/public/memberships/enums/membership-role.enum.ts
enum MembershipRole {
  OWNER  = 'owner',
  ADMIN  = 'admin',
  MEMBER = 'member',
}
```

| Role | Implied capabilities |
|---|---|
| `owner` | Can update/delete the tenant; only one per tenant (assigned at creation) |
| `admin` | Tenant administration (tenant-level, not platform-level) |
| `member` | Read/participate access within the tenant |

### 3.3 DTOs

**`CreateMembershipDto`**

| Field | Validation | Required |
|---|---|---|
| `userId` | IsUUID | Yes |
| `tenantId` | IsUUID | Yes |
| `role` | IsEnum(MembershipRole) | No — defaults to `member` |

**`UpdateMembershipRoleDto`**

| Field | Validation | Required |
|---|---|---|
| `role` | IsEnum(MembershipRole) | Yes |

### 3.4 Service — `MembershipService`

| Method | Signature | Description |
|---|---|---|
| `create` | `(dto): Promise<Membership>` | Creates membership; validates tenant exists; throws `ConflictException` on duplicate `(userId, tenantId)` |
| `findById` | `(id): Promise<Membership>` | Throws `NotFoundException` if absent |
| `findByTenantId` | `(tenantId): Promise<Membership[]>` | All memberships for a tenant, ordered by `createdAt` |
| `findByUserId` | `(userId): Promise<Membership[]>` | All memberships for a user, ordered by `createdAt` |
| `updateRole` | `(id, dto): Promise<Membership>` | Changes the role on an existing membership |
| `remove` | `(id): Promise<void>` | Hard delete |

### 3.5 Controller — `MembershipController`

Route prefix: `memberships`
Global guard: `PlatformJwtAuthGuard`

| Method | Path | Guard / Decorator | Description |
|---|---|---|---|
| POST | `/` | `@Roles(SUPER_ADMIN)` | Manually create membership |
| GET | `/tenant/:tenantId` | — | List memberships for a tenant |
| GET | `/user/:userId` | — | List memberships for a user |
| GET | `/:id` | — | Get single membership |
| PATCH | `/:id` | `@Roles(SUPER_ADMIN)` | Update role |
| DELETE | `/:id` | `@Roles(SUPER_ADMIN)` | Remove membership |

---

## 4. Platform Authentication

**Location:** `modules/public/auth/`

### 4.1 Endpoints

Route prefix: `platform/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | Public | Register a new platform user |
| POST | `/login` | Public | Authenticate and receive JWT |
| GET | `/me` | `PlatformJwtAuthGuard` | Return current user profile with memberships |

### 4.2 Request / Response Shapes

**Register & Login response:**
```json
{
  "access_token": "<jwt>",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "fullName": "Jane Doe",
    "role": "user"
  }
}
```

**JWT payload:**
```json
{
  "sub": "<userId>",
  "email": "user@example.com",
  "role": "user"
}
```

JWT expiry defaults to `24h` (configurable via `jwt.expiresIn` in config).

### 4.3 Guards & Decorators

**Location:** `common/guards/`, `common/decorators/`

| Artifact | File | Purpose |
|---|---|---|
| `PlatformJwtAuthGuard` | `guards/platform-jwt-auth.guard.ts` | Validates Bearer token using `platform-jwt` strategy; applied to all protected routes |
| `RolesGuard` | `guards/roles.guard.ts` | Reads `@Roles()` metadata; compares `request.user.role`; returns 403 on mismatch |
| `@Roles(...roles)` | `decorators/roles.decorator.ts` | Sets `ROLES_KEY` metadata on handler; used alongside `RolesGuard` |
| `@CurrentUser()` | `decorators/current-user.decorator.ts` | Param decorator that extracts `request.user` injected by Passport |

Usage pattern:
```ts
@UseGuards(PlatformJwtAuthGuard, RolesGuard)
@Roles(PlatformRole.SUPER_ADMIN)
@Get('/')
findAll() { ... }
```

---

## 5. Module Dependency Graph

```
AppModule
└── PublicModule (or direct imports)
    ├── PlatformAuthModule
    │   └── UserModule (for UserService)
    ├── UserModule
    ├── TenantModule
    │   └── TenantConnectionService (dynamic DataSource per tenant)
    └── MembershipModule
        └── TenantModule (for TenantService)
```

`TenantModule` and `UserModule` both export their services so they can be consumed by `MembershipModule` and `PlatformAuthModule`.

---

## 6. Authorization Matrix

| Action | `super_admin` | Tenant `owner` | Tenant `admin` | Tenant `member` | Unauthenticated |
|---|---|---|---|---|---|
| List all tenants | Yes | Own only | Own only | Own only | No |
| Create tenant | Yes | Yes (becomes owner) | Yes (becomes owner) | Yes (becomes owner) | No |
| Update tenant | Yes | Yes (own) | No | No | No |
| Delete tenant | Yes | No | No | No | No |
| List all users | Yes | No | No | No | No |
| Create platform user | Yes | No | No | No | No |
| Update own profile | Yes | Yes | Yes | Yes | No |
| Manage memberships | Yes | No | No | No | No |

---

## 7. Error Reference

| Scenario | Exception | HTTP Status |
|---|---|---|
| Duplicate email on user create | `ConflictException` | 409 |
| Duplicate `(userId, tenantId)` on membership create | `ConflictException` | 409 |
| User/Membership not found | `NotFoundException` | 404 |
| Tenant not found or no access | `NotFoundException` | 404 |
| Role insufficient for action | `ForbiddenException` (via RolesGuard) | 403 |
| Invalid or missing JWT | `UnauthorizedException` (via Passport) | 401 |
| DTO validation failure | `BadRequestException` (via ValidationPipe) | 400 |
