# Platform Admin Module

Technical documentation for the platform-level modules that sit outside any single school: **Users** (global accounts), **Organizations** (schools), and **Memberships** (the link between them). Platform authentication is covered in section 4.

All paths are relative to `backend/src/`. All routes are served under the global `/api` prefix (e.g. `POST /api/organizations`).

---

## Overview

Everything lives in the single `public` PostgreSQL schema. A school is an `Organization`; every school-owned table carries an `org_id` column with a cascading FK to `organizations` (via `OrgScopedEntity`, `tenancy/org-scoped.entity.ts`) and is protected by a row-level-security policy (`tenancy/rls.ts`).

```
users ──<  memberships  >── organizations ──< (every org-scoped table: roles, user_roles, students, ...)
  │                              │
  └──<  auth_tokens  >───────────┘   (org_id nullable: null = platform-issued)
```

- `users` is **global**: one account (one email/password) across all schools.
- `memberships` holds everything per-school about a user: membership role (`owner`/`admin`/`member`), the school-admin flag `is_admin`, and membership `status`.
- `user_roles` (org-scoped, RBAC module) assigns tenant roles to users inside an org.

The platform controllers documented here use `@InjectRepository` / `@InjectDataSource` on the **root connection** (table owner), which bypasses RLS. Their routes are excluded from `TenantMiddleware` in `app.module.ts` (`organizations`, `memberships`, `platform/auth`, `platform/users`, `public`, plus `health` and `dev/mail`), so they never need an `x-tenant-id` header.

Every protected platform request carries a **platform JWT** (Passport strategy `platform-jwt`). There is no platform role enum; a single boolean on the account decides access:

| `users.is_admin` | Meaning |
|---|---|
| `true` | Platform super-admin: full access to all organizations, users and memberships |
| `false` | Regular platform user: can create organizations and manage the ones they **own** |

> `users.is_admin` (platform super-admin) is unrelated to `memberships.is_admin` (school admin inside one org, carried in **tenant** JWTs). `PlatformJwtStrategy` rejects any token carrying `orgId`, so a school admin's tenant token can never pass `PlatformAdminGuard`.

---

## 1. Users Module

**Location:** `modules/users/` (platform side: `PlatformUserController`, `UserService`; the tenant side `OrgUserController`/`OrgUserService` on `/users` is out of scope here)

### 1.1 Entity: `User`

Database table: `public.users`

| Column (property) | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | Auto-generated |
| `email` | varchar | Unique, Not Null | Global login identifier |
| `password` (`password`) | varchar | Not Null, `select: false` | bcrypt hash (10 rounds); only loaded with an explicit `select` |
| `name` | varchar | Not Null | Single display-name field |
| `status` | enum `UserStatus` | Not Null, default `active` | Global account state |
| `is_admin` (`isAdmin`) | boolean | default `false` | Platform super-admin flag |
| `email_verified_at` (`emailVerifiedAt`) | timestamptz | Nullable | Set when the email is verified (or on owner activation) |
| `created_at` / `updated_at` | timestamp | Auto | |
| `deleted_at` (`deletedAt`) | timestamp | Nullable | `@DeleteDateColumn` (soft-delete column; see note in 1.4) |

Relations: `memberships`: OneToMany → `Membership`.

`@AfterInsert` / `@AfterUpdate` / `@AfterRemove` hooks only `console.log` the event.

### 1.2 Enums

```ts
// modules/users/enums/user-status.enum.ts
enum UserStatus {
  PENDING     = 'pending',     // registered, email not verified
  ACTIVE      = 'active',
  SUSPENDED   = 'suspended',   // admin-suspended
  DEACTIVATED = 'deactivated',
  BANNED      = 'banned',
}
```

Platform login requires `active` (a `pending` account without `emailVerifiedAt` gets a dedicated "verify your email" 403). Tenant login blocks `suspended`, `deactivated` and `banned`.

### 1.3 DTOs

**`CreateUserDto`** (`POST /platform/users`)

| Field | Validation | Required |
|---|---|---|
| `name` | IsString, IsNotEmpty | Yes |
| `email` | IsEmail | Yes |
| `password` | IsString, MinLength(6) | Yes |
| `status` | IsEnum(UserStatus) | No (defaults to `active`) |
| `isAdmin` | IsBoolean | No (defaults to `false`) |

**`UpdateUserDto`** (`PATCH /platform/users/:id`): all optional.

| Field | Validation |
|---|---|
| `name` | IsString |
| `status` | IsEnum(UserStatus) |
| `isAdmin` | IsBoolean |

Non-admin callers that send `status` or `isAdmin` get a **403** (the fields are rejected, not silently stripped). Email and password are not editable here (see `platform/auth/change-password`).

**`FilterUserDto`** (query on `GET /platform/users`): optional `id`, `name`, `email`, matched **exactly** (no partial match, no pagination).

### 1.4 Service: `UserService`

Every method takes a `RequestContextDto` (`ctx`) first; `ctx.user` is `{ id, email, status, isAdmin }` built from the JWT.

| Method | Signature | Description |
|---|---|---|
| `findAll` | `(ctx, filter: FilterUserDto): Promise<User[]>` | Exact-match filter on `id`/`name`/`email` |
| `findById` | `(ctx, id): Promise<User>` | `NotFoundException` if absent |
| `createPlatformUser` | `(ctx, dto: CreateUserDto): Promise<User>` | `ConflictException` on duplicate email; hashes password |
| `update` | `(ctx, targetId, dto: UpdateUserDto): Promise<User>` | Self or admin; only admins may change `status`/`isAdmin` (else 403) |
| `remove` | `(ctx, targetId): Promise<void>` | `NotFoundException` if absent, then **hard delete** (`repo.delete`), so `deleted_at` is never used. Memberships and `user_roles` cascade via FK; `auth_tokens` rows have no FK to `users` and are left behind |

### 1.5 Controller: `PlatformUserController`

Route prefix: `platform/users`. Class guard: `PlatformJwtAuthGuard`. Swagger: `@ApiBearerAuth('platform-jwt')`.

| Method | Path | Guard | Description |
|---|---|---|---|
| GET | `/` | `PlatformAdminGuard` | List users (`FilterUserDto` query) |
| POST | `/` | `PlatformAdminGuard` | Create user (201) |
| GET | `/:id` | (controller check) | Self or admin, else 403 `Access denied` |
| PATCH | `/:id` | (service check) | Update (rules in 1.3/1.4) |
| DELETE | `/:id` | `PlatformAdminGuard` | Hard delete |

`:id` is validated with `ParseUUIDPipe`.

---

## 2. Organizations Module

**Location:** `modules/organizations/`

### 2.1 Entity: `Organization`

Database table: `public.organizations`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | Auto-generated |
| `name` | varchar | Not Null | Display name (not unique) |
| `slug` | varchar | Unique, Not Null | Used as the subdomain and the `x-tenant-id` header value |
| `domain` | varchar | Unique, Nullable | Optional custom domain (e.g. `erp.acme.com`) |
| `status` | enum `OrganizationStatus` | Not Null, default `active` | |
| `created_at` / `updated_at` | timestamp | Auto | |

Relations: `memberships`: OneToMany → `Membership`.

All org-scoped tables (`OrgScopedEntity`), `memberships` and `auth_tokens.org_id` reference `organizations(id)` with `ON DELETE CASCADE`.

### 2.2 Enums

```ts
// modules/organizations/enums/organization-status.enum.ts
enum OrganizationStatus {
  PENDING   = 'pending',
  ACTIVE    = 'active',
  INACTIVE  = 'inactive',
  SUSPENDED = 'suspended',
  ARCHIVED  = 'archived',
}
```

Only `active` is usable: `TenantMiddleware` answers every tenant route of a non-active org with 403 `Tenant "<slug>" is not active`, and the public lookup endpoints return 404 for non-active orgs. No other status has distinct behavior.

### 2.3 DTOs

**`CreateOrganizationDto`**

| Field | Validation | Required |
|---|---|---|
| `name` | IsString, IsNotEmpty, Length(3, 100) | Yes |
| `slug` | IsString, Length(3, 63), Matches(`/^[a-z0-9_]+$/`) | Yes |
| `domain` | IsString, Length(3, 63), IsFQDN (TLD required, no underscores) | No |
| `ownerUserId` | IsUUID('4') | No (honored only for platform admins) |

**`UpdateOrganizationDto`**

| Field | Validation | Required |
|---|---|---|
| `name` | IsString, Length(3, 100) | **Effectively yes**: it has no `@IsOptional()`, so a PATCH without `name` fails validation |
| `domain` | IsString, Length(3, 63), IsFQDN | No |
| `status` | IsEnum(OrganizationStatus) | No |

`slug` is not in the update DTO (unknown fields are rejected by the global `ValidationPipe`), so it is immutable after creation.

**`TransferOwnershipDto`**

| Field | Validation | Required |
|---|---|---|
| `newOwnerUserId` | IsUUID('4') | Yes |
| `demoteOldOwnerTo` | IsEnum: `admin` \| `member` \| `remove` | No (default `admin`) |

### 2.4 Service: `OrganizationService`

```ts
interface OwnerActivation { token: string; orgSlug: string }
interface CreateOrganizationResult { organization: Organization; ownerActivation?: OwnerActivation }
```

| Method | Signature | Description |
|---|---|---|
| `createOrganization` | `(ctx, dto): Promise<CreateOrganizationResult>` | See provisioning flow below |
| `transferOwnership` | `(ctx, orgId, dto): Promise<{ membership; ownerActivation? }>` | Admin only. Atomically provisions the new owner and demotes/removes the old one |
| `reissueOwnerActivation` | `(ctx, orgId): Promise<OwnerActivation>` | Admin or the org's OWNER. Mints a fresh activation token for the current owner (the old raw token is unrecoverable) and emails it |
| `getAllOrganizations` | `(ctx): Promise<Organization[]>` | Admin: all orgs. Others: delegates to `getOrganizationsByUser` |
| `getOrganizationsByUser` | `(ctx, userId): Promise<Organization[]>` | Orgs where the user has any membership |
| `findById` | `(ctx, id): Promise<Organization \| null>` | Raw lookup |
| `findBySlug` | `(slug): Promise<Organization \| null>` | Raw lookup (used by `TenantMiddleware` and the public endpoint) |
| `findByDomain` | `(domain): Promise<Organization \| null>` | Strips port, lowercases, then looks up `domain` |
| `findByIdForUser` | `(ctx, id): Promise<Organization>` | 404 if missing; admin sees all; others need any membership (else 403) |
| `updateOrganization` | `(ctx, id, dto): Promise<Organization>` | 404 if missing; admin or OWNER membership (else 403). Invalidates the in-memory slug/domain caches |
| `deleteOrganization` | `(ctx, id): Promise<void>` | 404 if missing; deletes the row (cascade) and invalidates caches |

**Ownership rules on create:**

- Non-admin caller: the caller becomes OWNER; `dto.ownerUserId` is ignored.
- Admin with `ownerUserId`: that user (validated up-front, 404 if absent) becomes OWNER.
- Admin without `ownerUserId`: org is created with **no membership**; assign an owner later with `transfer-ownership` or `POST /memberships` (`role: owner`).

**Org-provisioning flow (`createOrganization`):**

```
dataSource.transaction(manager => {
  1. Reject duplicate slug (ConflictException 409)
  2. INSERT organizations row
  3. rbacSeederService.seedSystemRoles(manager, org.id)
       -> idempotently inserts the SYSTEM_ROLES from rbac/system-roles.seed.ts
          (admin = all permissions, staff, ...) with is_system = true
  4. if owner: ownerProvisioning.provisionOwner(manager, { orgId, userId })
       -> upsert membership: role = owner, is_admin = true,
          status = pending (new membership) or unchanged (existing)
       -> grant the seeded `admin` role in user_roles (if not already)
       -> insert auth_tokens row: type = activation, org_id = org.id,
          sha256(token) only, expires in 7 days
})
5. After commit: ownerProvisioning.sendActivationEmail(owner, org.slug, token)
   (best effort; link = <appUrl>/activate?token=...&tenant=<slug>)
6. Return { organization, ownerActivation: { token, orgSlug } }
```

A failure in steps 1 to 4 rolls back everything. The owner redeems the token at the tenant endpoint `POST /auth/activate` (with the org's `x-tenant-id`), which sets the account password, marks the email verified (`pending` accounts become `active`), sets the membership to `active` and signs them in.

> A pending OWNER membership cannot sign in to the school (`Membership is pending`) until activated, including a regular user who created the org for themselves.

**Transfer ownership (`transferOwnership`)**, one transaction: finds existing OWNER memberships (oldest = current; 400 if the target is already owner), runs `provisionOwner` for the new owner, then handles the old owner according to `demoteOldOwnerTo`: `admin` (role → admin, `is_admin` stays true), `member` (role → member, `is_admin` → false) or `remove` (deletes the membership and all of the user's `user_roles` in the org). Any extra OWNER rows are demoted to admin. Sends the activation email after commit.

**Deletion semantics (`deleteOrganization`):** a single `DELETE FROM organizations`. The `org_id` FKs cascade to memberships, org-issued auth tokens, roles, user_roles and every other org-scoped table. Global `users` rows are kept. There is no soft delete and no confirmation step.

### 2.5 Controllers

**`OrganizationController`**: route prefix `organizations`. Class guard: `PlatformJwtAuthGuard`. `:id` uses `ParseUUIDPipe`.

| Method | Path | Guard / rule | Response `data` |
|---|---|---|---|
| GET | `/` | Admin: all; others: orgs with a membership | `Organization[]` |
| GET | `/:id` | `findByIdForUser` | `Organization` |
| POST | `/` | Any platform user (see ownership rules) | `{ ...organization, activation: OwnerActivation \| null }` (201) |
| PATCH | `/:id` | Admin or OWNER (service) | `Organization` |
| POST | `/:id/transfer-ownership` | `PlatformAdminGuard` | `{ ...membership, activation }` |
| POST | `/:id/owner/activation-link` | Admin or OWNER (service) | `OwnerActivation` |
| DELETE | `/:id` | `PlatformAdminGuard` | none |

Note that the raw activation token is returned in the API response as well as emailed.

**`PublicOrganizationController`**: route prefix `public/organizations`, no auth. Used by the frontend before login.

| Method | Path | Query | Response `data` |
|---|---|---|---|
| GET | `/resolve` | `host` (required, else 400) | `{ slug, name, status }`; 404 unless an **active** org has that custom domain |
| GET | `/by-slug` | `slug` (required, else 400) | `{ slug, name, status }`; 404 unless an **active** org has that slug |

---

## 3. Memberships Module

**Location:** `modules/memberships/`

A membership grants a global user access to one organization.

### 3.1 Entity: `Membership`

Database table: `public.memberships`. Unique index `uq_memberships_org_user` on `(org_id, user_id)`: one membership per user per org. `org_id` is NOT NULL, so the table is under RLS for the tenant pool (platform code uses the owner connection).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `user_id` | uuid | FK → `users(id)`, ON DELETE CASCADE | |
| `org_id` | uuid | FK → `organizations(id)`, ON DELETE CASCADE, indexed | |
| `role` | enum `MembershipRole` | default `member` | |
| `is_admin` | boolean | default `false` | School admin: bypasses tenant RBAC checks; carried in tenant JWTs |
| `status` | enum `MembershipStatus` | default `active` | Tenant login requires `active` |
| `created_at` / `updated_at` | timestamp | Auto | |

Relations: `user` → `User`, `organization` → `Organization` (both ManyToOne, not eager-loaded).

### 3.2 Enums

```ts
enum MembershipRole   { OWNER = 'owner', ADMIN = 'admin', MEMBER = 'member' }
enum MembershipStatus { PENDING = 'pending', ACTIVE = 'active', SUSPENDED = 'suspended', DEACTIVATED = 'deactivated' }
```

| Role | Effect |
|---|---|
| `owner` | `is_admin = true`; can update the org, manage its memberships, re-issue its activation link. One per org is enforced by the service (not by a DB constraint) |
| `admin` | `is_admin = true` (school admin inside the tenant app); no extra platform rights |
| `member` | `is_admin = false`; tenant access governed by RBAC roles |

### 3.3 DTOs

**`CreateMembershipDto`**: `userId` (IsUUID, required), `orgId` (IsUUID, required), `role` (IsEnum(MembershipRole), optional, default `member`).

**`UpdateMembershipRoleDto`**: `role` (IsEnum(MembershipRole), required).

**`FilterMembershipDto`** (query on `GET /memberships`): optional `userId`, `orgId` (IsString).

### 3.4 Service: `MembershipService`

"Owner-or-admin" below means platform admin, or the caller holds the OWNER membership of that org (else 403 `Access denied`).

| Method | Signature | Description |
|---|---|---|
| `create` | `(ctx, dto): Promise<{ membership; ownerActivation? }>` | Owner-or-admin of `dto.orgId`. Non-admins cannot create `owner` (403). 404 if org/user missing; 409 on duplicate `(userId, orgId)`. Role `owner`: 409 if the org already has one, otherwise `provisionOwner` in a transaction plus activation email (membership starts `pending`). Other roles: plain insert, `status = active`, `is_admin = (role === admin)` |
| `findAll` | `(ctx, filter): Promise<Membership[]>` | Admin: filtered over all. Others: only their own (403 if `userId` is someone else) |
| `findById` | `(ctx, id): Promise<Membership>` | 404 if missing; admin, the membership's user, or owner of its org |
| `findByOrgId` | `(ctx, orgId): Promise<Membership[]>` | 404 if org missing; owner-or-admin; ordered by `createdAt` |
| `findByUserId` | `(ctx, userId): Promise<Membership[]>` | Self or admin (else 403); 404 if user missing; ordered by `createdAt` |
| `updateRole` | `(ctx, id, dto): Promise<Membership>` | Owner-or-admin. Non-admins cannot modify an owner membership or assign `owner`. Assigning `owner` when another owner exists → 409 (use transfer-ownership). Sets `is_admin = role !== member`. Does not touch `user_roles` |
| `remove` | `(ctx, id): Promise<void>` | Owner-or-admin; non-admins cannot remove an owner membership. Deletes the membership and the user's `user_roles` in that org in one transaction |

Responses contain the bare membership rows (`userId`, `orgId`, ...). User and organization details are not joined.

### 3.5 Controller: `MembershipController`

Route prefix: `memberships`. Class guard: `PlatformJwtAuthGuard`. Path params are **not** UUID-validated.

| Method | Path | Rule | Response `data` |
|---|---|---|---|
| GET | `/` | `findAll` (query `userId`, `orgId`) | `Membership[]` |
| GET | `/organization/:orgId` | `findByOrgId` | `Membership[]` |
| GET | `/user/:userId` | `findByUserId` | `Membership[]` |
| GET | `/me` | caller's memberships | `Membership[]` |
| GET | `/:id` | `findById` | `Membership` |
| POST | `/` | `create` | `{ ...membership, activation: OwnerActivation \| null }` (201) |
| PATCH | `/:id` | `updateRole` | `Membership` |
| DELETE | `/:id` | `remove` | none |

---

## 4. Platform Authentication

**Location:** `modules/auth/` (`PlatformAuthController`, `PlatformAuthService`, `PlatformJwtStrategy`), `common/guards/`, `common/tokens/`.

### 4.1 Endpoints

Route prefix: `platform/auth`. Endpoints marked "throttled" use `AUTH_THROTTLE` (5 requests / 60 s) on top of the global `TenantThrottlerGuard`.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | Public, throttled | Create account (`status = pending`), email a verification link. **No JWT issued**; returns `{ email }` |
| POST | `/login` | Public, throttled | Returns token response. 401 bad credentials; 403 if pending and unverified; 401 `Account is <status>` if not active |
| POST | `/verify-email` | Public, throttled | `{ token }`: marks email verified, `pending` → `active`, consumes token, returns token response (auto-login) |
| GET | `/verify-email?token=` | Public | Pre-checks a verification token without consuming it → `{ email }` |
| POST | `/resend-verification` | Public, throttled | `{ email }`: re-sends if the account exists and is unverified; always the same generic message |
| POST | `/forgot-password` | Public, throttled | `{ email }`: emails a reset link if the account exists; always the same generic message |
| GET | `/reset-password?token=` | Public | Pre-checks a reset token → `{ email }` |
| POST | `/reset-password` | Public, throttled | `{ token, password (min 6) }`: sets the password, consumes the token |
| POST | `/change-password` | `PlatformJwtAuthGuard` | `{ currentPassword, newPassword (min 6) }`; 400 if the current password is wrong |
| GET | `/me` | `PlatformJwtAuthGuard` | The `User` row with its `memberships` relation |

All responses use the standard envelope `{ success, statusCode, message, data }`. Platform tokens (verification, reset) are stored in `auth_tokens` with `org_id = NULL`; only those are redeemable here (school-issued tokens are not).

### 4.2 Request / Response Shapes

**Register request:** `{ "name": "Jane Doe", "email": "jane@example.com", "password": "secret1" }` (password min 6).

**Login / verify-email `data`:**
```json
{
  "access_token": "<jwt>",
  "token_type": "Bearer",
  "user": {
    "id": "uuid",
    "email": "jane@example.com",
    "name": "Jane Doe",
    "status": "active",
    "isAdmin": false
  }
}
```

**Platform JWT payload:**
```json
{ "sub": "<userId>", "email": "jane@example.com", "status": "active", "isAdmin": false }
```

`PlatformJwtStrategy.validate` rejects payloads containing `orgId` (tenant tokens share the signing secret) and sets `request.user = { userId, email, status, isAdmin }`; the `@RequestContext()` decorator maps it to `ctx.user = { id, email, status, isAdmin }`. The strategy does not re-read the database, so a suspended or demoted user keeps their access until the token expires.

Expiry comes from `jwt.expiresIn` (`JWT_EXPIRES_IN`, default `1d`; `AuthModule` falls back to `24h` if unset). There is no refresh token or logout/denylist.

### 4.3 Auth tokens

`auth_tokens` (`modules/auth/entities/auth-token.entity.ts`): `id`, `user_id` (uuid, no FK), `org_id` (nullable, FK → organizations ON DELETE CASCADE), `token_hash` (sha256 hex, unique), `type` (`AuthTokenType`), `expires_at`, `used_at` (single use), `created_at`. Raw tokens are 32 random bytes (hex) from `common/tokens/secure-token.util.ts`.

| `AuthTokenType` | Issued by | TTL (`common/tokens/token-ttl.constants.ts`) |
|---|---|---|
| `email_verification` | platform register/resend (org_id null), tenant equivalents | 24 h |
| `password_reset` | platform/tenant forgot-password | 1 h |
| `activation` | `OwnerProvisioningService.provisionOwner` (org_id set) | 7 days |

The table has a nullable `org_id`, so it is not under RLS.

### 4.4 Guards & Decorators

| Artifact | File | Purpose |
|---|---|---|
| `PlatformJwtAuthGuard` | `common/guards/platform-jwt-auth.guard.ts` | `AuthGuard('platform-jwt')`; 401 on missing/invalid/tenant token |
| `PlatformAdminGuard` | `common/guards/platform-admin.guard.ts` | Allows only `request.user.isAdmin === true`; returns 403 otherwise. Use after `PlatformJwtAuthGuard` |
| `@RequestContext()` | `common/decorators/request-context.decorator.ts` | Builds `RequestContextDto` (`userId`, `user`, `orgId`, ip, ...) from the request |
| `SelfOrAdminGuard` | `common/guards/self-or-admin.guard.ts` | Exists but is unused (and compares `request.user.id`, which the platform strategy does not set) |

Usage pattern:
```ts
@Controller('organizations')
@UseGuards(PlatformJwtAuthGuard)
export class OrganizationController {
  @Delete(':id')
  @UseGuards(PlatformAdminGuard)
  remove(@RequestContext() ctx: RequestContextDto, @Param('id', ParseUUIDPipe) id: string) { ... }
}
```

Finer rules (self-only, owner-only) are enforced in the services using `ctx.user`.

---

## 5. Module Dependency Graph

```
AppModule
├── MailModule (@Global, MailService)
├── TenancyModule (@Global; TenantMiddleware uses OrganizationService)
├── AuthModule
│   ├── UserModule
│   ├── RbacModule
│   └── JwtModule / PassportModule (PlatformJwtStrategy, JwtStrategy)
├── UserModule
│   └── RbacModule (MemberRepository)
├── OrganizationModule
│   ├── UserModule (UserService)
│   └── RbacModule (RbacSeederService, OwnerProvisioningService)
├── MembershipModule
│   ├── OrganizationModule (OrganizationService)
│   ├── UserModule (UserService)
│   └── RbacModule (OwnerProvisioningService)
└── RbacModule
```

`OwnerProvisioningService` lives in `modules/auth/services/` but is provided and exported by `RbacModule`.

---

## 6. Authorization Matrix

"Owner" = holds the OWNER membership of the target org. School `admin`/`member` memberships grant no extra platform rights.

| Action | Platform admin | Org owner | Other platform user | Unauthenticated |
|---|---|---|---|---|
| List organizations | All | Own memberships only | Own memberships only | No |
| View organization | Any | Yes | Only if a member | No |
| Create organization | Yes (owner optional via `ownerUserId`) | Yes (becomes owner) | Yes (becomes owner) | No |
| Update organization (name/domain/status) | Yes | Yes | No | No |
| Re-issue owner activation link | Yes | Yes | No | No |
| Transfer ownership | Yes | No | No | No |
| Delete organization | Yes | No | No | No |
| List / create / delete platform users | Yes | No | No | No |
| View / update own account (name only) | Yes | Yes | Yes | No |
| Change another user's status / admin flag | Yes | No | No | No |
| Create membership (admin/member) | Yes | Yes (own org) | No | No |
| Create membership with role `owner` | Yes (if org has none) | No | No | No |
| Change membership role | Yes | Yes (not owner rows, not to `owner`) | No | No |
| Remove membership | Yes | Yes (not owner rows) | No | No |
| List memberships of an org | Yes | Yes | No | No |
| List a user's memberships | Any user | Self only | Self only | No |
| Resolve org by host/slug (public) | Yes | Yes | Yes | Yes |

---

## 7. Error Reference

| Scenario | Exception | HTTP Status |
|---|---|---|
| Duplicate email on register / user create | `ConflictException` | 409 |
| Duplicate organization slug | `ConflictException` | 409 |
| Duplicate `(userId, orgId)` membership | `ConflictException` | 409 |
| Creating/assigning `owner` when the org already has one | `ConflictException` | 409 |
| Transfer to the current owner | `BadRequestException` | 400 |
| User / membership / organization not found | `NotFoundException` | 404 |
| No active org for host/slug (public endpoints) | `NotFoundException` | 404 |
| Missing `host`/`slug` query (public endpoints) | `BadRequestException` | 400 |
| Not a member of the org (view) / not owner or admin | `ForbiddenException` | 403 |
| Non-admin on a `PlatformAdminGuard` route | `ForbiddenException` (guard returns false) | 403 |
| Login with unverified pending account | `ForbiddenException` | 403 |
| Bad credentials / account not active | `UnauthorizedException` | 401 |
| Invalid or missing JWT, or a tenant JWT on a platform route | `UnauthorizedException` (Passport) | 401 |
| Invalid/expired/used verification or reset token | `BadRequestException` | 400 |
| Wrong current password on change-password | `BadRequestException` | 400 |
| DTO validation failure or unknown body field | `BadRequestException` (ValidationPipe) | 400 |
| Non-UUID `:id` on organization/user routes | `BadRequestException` (ParseUUIDPipe) | 400 |
| Duplicate custom `domain` (not pre-checked; DB unique violation) | unhandled `QueryFailedError` | 500 |
| Too many auth requests | `ThrottlerException` | 429 |
