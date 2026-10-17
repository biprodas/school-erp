# Tenanted RBAC — User Stories

> **Note (2026-10-17):** this document predates the move from schema-per-tenant to a shared schema with `org_id` + row-level security, tenants → organizations, and one global `users` table. See `CLAUDE.md` (Backend architecture) for the current design.

These stories cover the per-tenant access-control layer: tenant-scoped authentication, tenant user management, roles, permissions, and role assignments. They are written from the perspective of the four actors that interact with a tenant after it has been provisioned.

**Actors**

| Actor | Who they are |
|---|---|
| **Tenant Admin** | A user inside a tenant with `isAdmin = true`. Bypasses every permission check inside the tenant. The first registered user becomes one automatically; an existing admin can grant or revoke the flag on any other user. |
| **Role Manager** | A non-admin user who holds `roles:manage` and/or `roles:assign` — they can shape the tenant's RBAC without having full admin powers. |
| **Tenant User** | Any logged-in user with a non-empty set of permissions from one or more assigned roles (teacher, staff, librarian, etc.). |
| **New User** | Someone going through `/auth/register` for a specific tenant. |

---

## Authentication

---

**US-T-AUTH-01 — Register inside a tenant and bootstrap the first admin**

> As a New User of a freshly-provisioned tenant,
> I want to register an account by submitting my name, email, and password against `x-tenant-id: <slug>`,
> so that I can log in and start setting up the school.

Acceptance criteria:
- I submit first name, last name, email, and a password (minimum 6 characters).
- The request is routed to my tenant via the `x-tenant-id` header (or a tenant subdomain).
- If no other user exists in this tenant yet, the system marks my account `isAdmin = true` so I can bootstrap roles and members.
- If the email already exists in this tenant, registration is rejected.
- On success I receive an access token and am logged in.

---

**US-T-AUTH-02 — Log in to a tenant**

> As a Tenant User,
> I want to log in with my email and password against my tenant,
> so that I can access that school's workspace.

Acceptance criteria:
- I submit my email and password with the `x-tenant-id` header set.
- On valid credentials I receive a JWT plus my profile and the tenant block (`id`, `slug`, `schema`).
- The response includes my role names so the UI can render the right menu without an extra call.
- Wrong credentials return `Invalid credentials`.

---

**US-T-AUTH-03 — View my own profile within a tenant**

> As a Tenant User,
> I want to call `GET /auth/me`,
> so that I can see my own profile and the names of roles I currently hold.

Acceptance criteria:
- I do not need to provide my own user id.
- The response includes my email, names, status, `isAdmin` flag, and an array of role names.
- The password field is never returned.

---

## Tenant Users

---

**US-T-USER-01 — List users in my tenant**

> As a holder of `users:read` (or a Tenant Admin),
> I want to list users in my tenant,
> so that I can see who has access to the workspace.

Acceptance criteria:
- I receive every user in my tenant (results are scoped automatically by tenant schema).
- I can filter by `id`, `firstName`, `lastName`, `email`, or `roleId` via query params.
- When I pass `roleId`, only users assigned that role are returned.
- A user without `users:read` and without `isAdmin` gets `403 Missing required permission: users:read`.

---

**US-T-USER-02 — Create a user with initial roles**

> As a holder of `users:create` (or a Tenant Admin),
> I want to create a new user and optionally assign one or more roles at the same time,
> so that staff onboarding takes a single API call.

Acceptance criteria:
- I provide first name, last name, email, password, and optionally `roleIds` and `status`.
- Each `roleId` must reference an existing role; an unknown id fails the request before the user is created.
- The new user's password is hashed (bcrypt, 10 rounds).
- Duplicate email within the tenant is rejected with `Email already registered`.
- If I omit `status` the user is created as `active`.

---

**US-T-USER-03 — View a user**

> As a holder of `users:read`,
> I want to fetch a user record by id,
> so that I can inspect their profile and current status.

Acceptance criteria:
- The response contains the user's profile fields but never the password.
- A not-found id returns `404`.

---

**US-T-USER-04 — Update a user's name or status**

> As a holder of `users:update`,
> I want to change a user's first name, last name, or status,
> so that I can keep records current and suspend or deactivate users without deleting them.

Acceptance criteria:
- I can submit any subset of `firstName`, `lastName`, `status`.
- `status` must be one of: `pending | active | suspended | deactivated | banned`.
- Other fields (email, password, `isAdmin`) cannot be modified via this endpoint.

---

**US-T-USER-05 — Soft-delete a user**

> As a holder of `users:delete`,
> I want to remove a user from the tenant,
> so that they no longer have access.

Acceptance criteria:
- The user's `deleted_at` is set (TypeORM soft delete); the row is preserved.
- All of the user's role assignments cascade-delete (`user_roles.user_id` FK is `CASCADE`).
- Their JWT remains valid until it expires (token revocation is out of scope today — see `[NOT IMPLEMENTED]` section).

---

**US-T-USER-06 — Promote another user to tenant admin**

> As a Tenant Admin,
> I want to set `isAdmin = true` on another user via `POST /users/:id/grant-admin`,
> so that they can help bootstrap or co-administer the tenant.

Acceptance criteria:
- Only users with `isAdmin = true` can call this endpoint (no permission key gates it; only `IsAdminGuard`).
- Non-admin callers get `403 Admin only`.
- Already-admin users are a no-op.

---

**US-T-USER-07 — Revoke admin from another user**

> As a Tenant Admin,
> I want to call `POST /users/:id/revoke-admin`,
> so that I can remove the RBAC-bypass from a user without deleting them.

Acceptance criteria:
- Only admins can call.
- The user retains their roles and continues to operate via assigned permissions only.
- Already-non-admin users are a no-op.

---

## Roles

---

**US-T-ROLE-01 — List roles in my tenant**

> As a holder of `roles:read`,
> I want to list every role in the tenant,
> so that I can see which roles exist and which are system-seeded.

Acceptance criteria:
- Results are ordered alphabetically by `name`.
- Each row includes `name`, `description`, `permissions[]`, and `isSystem`.
- The seven seeded roles (`admin`, `staff`, `teacher`, `accountant`, `librarian`, `parent`, `student`) are present in every tenant.

---

**US-T-ROLE-02 — View the permission catalog**

> As a holder of `roles:read`,
> I want to call `GET /permissions`,
> so that I can render a role editor with all the permissible actions grouped by resource.

Acceptance criteria:
- The response is grouped by resource: `[{ resource, permissions: [{ key, action }] }]`.
- The catalog is the **single source of truth**; it is code-defined and never out of sync with the guards.

---

**US-T-ROLE-03 — View a single role**

> As a holder of `roles:read`,
> I want to fetch a role by id,
> so that I can see its current permission list.

Acceptance criteria:
- A not-found id returns `404`.

---

**US-T-ROLE-04 — Create a custom role**

> As a holder of `roles:manage`,
> I want to create a custom role with a name, optional description, and a list of permissions,
> so that I can model school-specific responsibilities (e.g., "reviewer", "head_teacher").

Acceptance criteria:
- Name must be 2–64 characters; description ≤255 characters.
- Permissions are validated against the catalog; any unknown key returns `Unknown permission(s): <list>`.
- Duplicate name returns `Role "<name>" already exists`.
- The new role has `isSystem = false`.

---

**US-T-ROLE-05 — Update a role's name, description, or permissions**

> As a holder of `roles:manage`,
> I want to `PATCH /roles/:id`,
> so that I can rename a role, adjust its description, or change its permission list.

Acceptance criteria:
- All three fields are optional; only what I send is changed.
- Renaming a system role returns `403 System roles cannot be renamed`.
- A name clash on rename returns `409 Role "<name>" already exists`.
- Submitting permissions de-duplicates and validates them against the catalog.

---

**US-T-ROLE-06 — Replace a role's permission list atomically**

> As a holder of `roles:manage`,
> I want to `PUT /roles/:id/permissions` with the full desired list,
> so that the role editor can save a snapshot in a single request without first reading the current list.

Acceptance criteria:
- The body is a `permissions: string[]` array.
- The full list is replaced atomically; unspecified keys are removed.
- Unknown keys are rejected with `400 Unknown permission(s): <list>`.
- The endpoint works equally well on system roles (their permission lists are editable; only name and existence are locked).

---

**US-T-ROLE-07 — Delete a custom role**

> As a holder of `roles:manage`,
> I want to delete a role I created,
> so that I can remove obsolete role definitions.

Acceptance criteria:
- Deleting a system role returns `403 System roles cannot be deleted`.
- If the role is assigned to any users, the request returns `409 Role is assigned to N user(s). Pass ?force=true to delete it and remove those assignments.`
- Passing `?force=true` cascade-removes the assignments (handled by FK `ON DELETE CASCADE`) and deletes the role; the endpoint returns `204 No Content`.

---

## Role Assignments

---

**US-T-ASSIGN-01 — See which roles a user holds**

> As a holder of `roles:read`,
> I want to call `GET /users/:userId/roles`,
> so that I can see exactly which roles are assigned to a given user.

Acceptance criteria:
- The response is a list of full role objects (including their permission arrays).
- An empty list is returned if the user holds no roles.

---

**US-T-ASSIGN-02 — Assign a role to a user**

> As a holder of `roles:assign`,
> I want to `POST /users/:userId/roles` with `{ roleId }`,
> so that the user gains that role's permissions on the next request.

Acceptance criteria:
- A non-existent role id returns `404`.
- Re-assigning the same role is a no-op (unique index on `user_roles(user_id, role_id)` enforces uniqueness).
- After assignment, the user's effective permissions are the **union** of every assigned role's permissions on their next request.

---

**US-T-ASSIGN-03 — Revoke a role from a user**

> As a holder of `roles:assign`,
> I want to `DELETE /users/:userId/roles/:roleId`,
> so that the user loses that role's permissions.

Acceptance criteria:
- A non-existent role id returns `404`.
- Removing the **last** assignment of the `admin` role across **all** users returns `409 Cannot remove the last admin role assignment` to prevent locking the tenant out of administration.
- Removing a non-existent assignment is silently a no-op.

---

**US-T-ASSIGN-04 — Effective permissions are resolved fresh per request**

> As a Role Manager,
> I want changes to a role's permissions or a user's role assignments to take effect immediately,
> so that I don't have to ask users to log out and back in after I edit their access.

Acceptance criteria:
- `PermissionResolverService.getEffectivePermissions(userId)` runs on every protected request.
- It loads every `UserRole` for the user, then unions the `permissions` arrays of each role.
- Updating a role's permission list (`PATCH /roles/:id` or `PUT /roles/:id/permissions`) changes what every assigned user can do on their **next** request — no cache to invalidate.

---

## Permission Enforcement

---

**US-T-PERM-01 — Tenant Admin bypass**

> As a Tenant Admin,
> I want my requests to bypass `PermissionsGuard` checks,
> so that I can administer the tenant without first granting myself the matching role.

Acceptance criteria:
- Any handler decorated with `@RequirePermissions(...)` allows the request when `request.user.isAdmin === true`.
- This bypass does **not** apply to admin-only `IsAdminGuard` routes (e.g., `grant-admin`) — those still require admin.
- The bypass is per-tenant: my admin status in tenant `acme` does not affect tenant `beta`.

---

**US-T-PERM-02 — Pass with one of multiple required permissions (OR semantics)**

> As a holder of either of two interchangeable permissions,
> I want a route decorated with `@RequirePermissions(A, B)` to accept me,
> so that endpoints that can be reached from multiple capabilities don't need bespoke guard code.

Acceptance criteria:
- A user holding **either** `A` **or** `B` is allowed.
- A user holding neither receives `403 Missing required permission: A or B`.

---

**US-T-PERM-03 — Clear 403 on missing permission**

> As a Tenant User without the required permission,
> I want a clear 403 response,
> so that the UI can show me a meaningful error rather than guessing why the call failed.

Acceptance criteria:
- The exception message lists the required permission keys joined by ` or `.
- The HTTP status is `403`.
- The request body is unaffected (no partial writes occurred).

---

**US-T-PERM-04 — Unauthenticated requests are rejected before RBAC**

> As an unauthenticated caller,
> I want to receive `401` for any RBAC-protected route,
> so that the distinction between "unauthenticated" and "missing permission" is clear.

Acceptance criteria:
- `JwtAuthGuard` runs first and rejects with `401` if the token is missing or invalid.
- `PermissionsGuard` runs second and assumes a valid `request.user`; if it lacks a `userId` it throws `Authentication required`.

---

**US-T-PERM-05 — Tenant context must be present**

> As a caller of any tenanted route,
> I want my request rejected when the tenant context is missing or invalid,
> so that I cannot accidentally execute queries against the wrong tenant.

Acceptance criteria:
- Missing `x-tenant-id` header and no resolvable subdomain → `TenantContextMissingException`.
- Slug fails the `^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$` pattern, or tenant not found → `TenantNotFoundException`.
- Tenant exists but `status !== active` → `TenantInactiveException`.
- These checks happen in `TenantMiddleware`, **before** any auth or permission guard runs.

---

---

## Suggested Stories — Missing or Not Yet Implemented

The stories below describe functionality that is absent from the current tenanted code. Each is marked with a status tag so the team can prioritise them.

> **Status tags**
> - `[NOT IMPLEMENTED]` — feature is completely absent; no endpoint or service method exists
> - `[PARTIAL]` — related data or logic exists but the specific behaviour is not exposed or enforced

---

### Authentication

---

**US-T-AUTH-04 — Change my own password** `[NOT IMPLEMENTED]`

> As a Tenant User,
> I want to change my password by providing my current and a new password,
> so that I can rotate credentials without admin involvement.

Acceptance criteria:
- I submit current password and a new one (≥6 characters).
- A wrong current password rejects the change.
- The new password is hashed and replaces the old.

---

**US-T-AUTH-05 — Request a password-reset link** `[NOT IMPLEMENTED]`

> As a Tenant User who has forgotten their password,
> I want to receive a single-use reset link by email,
> so that I can regain access without contacting an admin.

Acceptance criteria:
- I submit my email address with the tenant context.
- If the email is registered in this tenant, a time-limited reset link is sent.
- The response gives no indication when the email is unknown (security best practice).

---

**US-T-AUTH-06 — Reset password via link** `[NOT IMPLEMENTED]`

> As a Tenant User holding a valid reset token,
> I want to set a new password,
> so that I can log in again.

Acceptance criteria:
- The reset token is single-use and expires after a configured period.
- After reset, the token is invalidated and cannot be reused.

---

**US-T-AUTH-07 — Refresh an expiring access token** `[NOT IMPLEMENTED]`

> As a Tenant User,
> I want to exchange a near-expiry token for a new one,
> so that my session stays active during long working sessions.

Acceptance criteria:
- A dedicated refresh endpoint accepts a non-expired token and issues a new one.
- Expired tokens cannot be refreshed.

---

**US-T-AUTH-08 — Log out and invalidate the current token** `[NOT IMPLEMENTED]`

> As a Tenant User,
> I want to log out,
> so that my token cannot be reused.

Acceptance criteria:
- Calling the logout endpoint adds my JWT to a denylist (or rotates a per-user token version).
- Subsequent requests with the same token are rejected.
- Note: JWTs are currently stateless, so this requires either a denylist or a refresh-token mechanism.

---

**US-T-AUTH-09 — Verify email after registration** `[NOT IMPLEMENTED]`

> As a New User,
> I want to verify my email after registering,
> so that the tenant can confirm the address belongs to me.

Acceptance criteria:
- A verification email is sent after `/auth/register`.
- Unverified accounts may have limited access until verification.

---

### Users

---

**US-T-USER-08 — Search users by partial name or email** `[NOT IMPLEMENTED]`

> As a holder of `users:read`,
> I want to search users by partial name or email,
> so that I can find people without scrolling through a long list.

Acceptance criteria:
- `firstName`, `lastName`, and `email` query params accept partial, case-insensitive matches.
- Today these filters use exact match only.

---

**US-T-USER-09 — Paginate the user list** `[NOT IMPLEMENTED]`

> As a holder of `users:read`,
> I want `GET /users` to return paginated results,
> so that large tenants don't return thousands of records in one response.

Acceptance criteria:
- I can pass `page` and `pageSize` (or similar) query params.
- The response includes total count, current page, and the data slice.

---

**US-T-USER-10 — Reject login for non-active users** `[PARTIAL]`

> As a Tenant Admin,
> I want users in `suspended | deactivated | banned | pending` to be unable to log in,
> so that status changes immediately restrict access.

Acceptance criteria:
- `POST /auth/login` checks `user.status === ACTIVE` before issuing a JWT.
- Note: `UserStatus` exists and is settable via `PATCH /users/:id`, but `AuthService.login` does not check it today.

---

### Roles & Permissions

---

**US-T-ROLE-08 — View my own effective permissions** `[NOT IMPLEMENTED]`

> As a Tenant User,
> I want to call `GET /auth/me/permissions` (or similar),
> so that the UI can disable buttons for actions I cannot perform without trial-and-error 403s.

Acceptance criteria:
- The response is a flat list of permission keys.
- For an admin, the response includes the special marker `*` (or the full catalog) to indicate the bypass.
- Note: `PermissionResolverService.getEffectivePermissions` already computes this; it is just not exposed via any controller.

---

**US-T-ROLE-09 — Require ALL permissions instead of ANY** `[PARTIAL]`

> As a developer writing a particularly sensitive endpoint,
> I want a `@RequireAllPermissions(...)` decorator,
> so that the route demands the intersection rather than the union of required keys.

Acceptance criteria:
- A new decorator + guard semantics that pass only when the user holds **every** listed key.
- Note: `PermissionsGuard` today is hard-coded to OR semantics (`required.some(...)`).

---

**US-T-ROLE-10 — Role hierarchy / inheritance** `[NOT IMPLEMENTED]`

> As a Tenant Admin,
> I want to declare that role A inherits from role B,
> so that I can compose roles without duplicating permission lists.

Acceptance criteria:
- A role definition can optionally reference one or more parent roles.
- Effective permissions are computed transitively.
- Note: today roles are a flat union of permission keys; there is no parent relation on `Role`.

---

**US-T-ROLE-11 — Audit log of role and permission changes** `[NOT IMPLEMENTED]`

> As a Tenant Admin,
> I want every role creation, permission change, and assignment to be recorded,
> so that I can investigate "who granted X this permission" after the fact.

Acceptance criteria:
- An append-only audit table records actor, action, target, before / after states, timestamp.
- The log is visible via a dedicated endpoint to admins.

---

**US-T-ROLE-12 — Localised role descriptions** `[NOT IMPLEMENTED]`

> As an end user,
> I want role names and descriptions surfaced in the UI to be localised,
> so that non-English schools can present them in their language.

Acceptance criteria:
- Seeded role descriptions are i18n keys (or have an i18n table) rather than free English text.
- Custom roles can carry per-locale descriptions.

---

### Assignments

---

**US-T-ASSIGN-05 — Self-leave a role** `[NOT IMPLEMENTED]`

> As a Tenant User,
> I want to remove a role from myself (subject to safeguards),
> so that I can voluntarily give up elevated access I no longer need.

Acceptance criteria:
- I cannot remove my own last `admin` role assignment (same safeguard as `roles:assign`).
- I cannot remove the role assignment for someone else this way.

---

**US-T-ASSIGN-06 — Bulk-assign or bulk-revoke** `[NOT IMPLEMENTED]`

> As a holder of `roles:assign`,
> I want to apply a role to many users (or many roles to one user) in a single request,
> so that bulk onboarding doesn't require N round-trips.

Acceptance criteria:
- A dedicated endpoint accepts `{ userIds: UUID[], roleId }` or `{ userId, roleIds: UUID[] }`.
- Validation is up-front: any invalid id rejects the whole request.

---

---

## Story Map Summary

```
Tenanted RBAC
│
├── Authentication
│   ├── US-T-AUTH-01  Register in tenant (first = admin)        [New User]
│   ├── US-T-AUTH-02  Log in to tenant                          [Any]
│   ├── US-T-AUTH-03  View own profile                          [Any]
│   ├── US-T-AUTH-04  Change own password                        [NOT IMPLEMENTED]
│   ├── US-T-AUTH-05  Request password-reset link                [NOT IMPLEMENTED]
│   ├── US-T-AUTH-06  Reset password via link                    [NOT IMPLEMENTED]
│   ├── US-T-AUTH-07  Refresh access token                       [NOT IMPLEMENTED]
│   ├── US-T-AUTH-08  Log out / invalidate token                 [NOT IMPLEMENTED]
│   └── US-T-AUTH-09  Verify email after registration            [NOT IMPLEMENTED]
│
├── Tenant Users
│   ├── US-T-USER-01  List users                                [users:read]
│   ├── US-T-USER-02  Create user with initial roles            [users:create]
│   ├── US-T-USER-03  View user                                 [users:read]
│   ├── US-T-USER-04  Update name / status                      [users:update]
│   ├── US-T-USER-05  Soft-delete user                          [users:delete]
│   ├── US-T-USER-06  Grant admin                               [Tenant Admin]
│   ├── US-T-USER-07  Revoke admin                              [Tenant Admin]
│   ├── US-T-USER-08  Search by partial name / email             [NOT IMPLEMENTED]
│   ├── US-T-USER-09  Paginate user list                         [NOT IMPLEMENTED]
│   └── US-T-USER-10  Reject login for non-active users          [PARTIAL]
│
├── Roles
│   ├── US-T-ROLE-01  List roles                                [roles:read]
│   ├── US-T-ROLE-02  View permission catalog                   [roles:read]
│   ├── US-T-ROLE-03  View single role                          [roles:read]
│   ├── US-T-ROLE-04  Create custom role                        [roles:manage]
│   ├── US-T-ROLE-05  Update name / description / permissions   [roles:manage]
│   ├── US-T-ROLE-06  Replace permissions atomically (PUT)      [roles:manage]
│   ├── US-T-ROLE-07  Delete role (with ?force=true)            [roles:manage]
│   ├── US-T-ROLE-08  View own effective permissions             [NOT IMPLEMENTED]
│   ├── US-T-ROLE-09  Require ALL permissions instead of ANY     [PARTIAL]
│   ├── US-T-ROLE-10  Role hierarchy / inheritance               [NOT IMPLEMENTED]
│   ├── US-T-ROLE-11  Audit log of role changes                  [NOT IMPLEMENTED]
│   └── US-T-ROLE-12  Localised role descriptions                [NOT IMPLEMENTED]
│
├── Assignments
│   ├── US-T-ASSIGN-01  List user's roles                       [roles:read]
│   ├── US-T-ASSIGN-02  Assign role to user                     [roles:assign]
│   ├── US-T-ASSIGN-03  Revoke role (last-admin safeguard)      [roles:assign]
│   ├── US-T-ASSIGN-04  Effective permissions fresh per request [Any]
│   ├── US-T-ASSIGN-05  Self-leave a role                        [NOT IMPLEMENTED]
│   └── US-T-ASSIGN-06  Bulk-assign or bulk-revoke               [NOT IMPLEMENTED]
│
└── Permission Enforcement
    ├── US-T-PERM-01  Tenant Admin bypass                        [Tenant Admin]
    ├── US-T-PERM-02  OR semantics across required permissions  [Any]
    ├── US-T-PERM-03  Clear 403 on missing permission            [Any]
    ├── US-T-PERM-04  Reject unauthenticated requests early      [Any]
    └── US-T-PERM-05  Reject missing / invalid tenant context    [Any]
```
