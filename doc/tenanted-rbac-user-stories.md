# Tenanted RBAC — User Stories

These stories cover the per-organization (school) access-control layer: tenant-scoped authentication, member management, roles, permissions, and role assignments. They are written from the perspective of the actors that interact with an organization after it has been created on the platform side.

Background: user accounts are global (one login across schools). A user belongs to a school through a **membership** (`memberships`: `role`, `is_admin`, `status`), and holds that school's roles through org-scoped `user_roles`. Every tenanted request resolves its organization from the `x-tenant-id` header, a subdomain, or a custom domain. Technical details are in `tenanted-rbac-module.md`.

**Actors**

| Actor | Who they are |
|---|---|
| **School Admin** | A member whose membership has `isAdmin = true`. Bypasses every permission check inside that school. The school owner is provisioned as one when the organization is created; an existing admin can grant or revoke the flag on any other member. |
| **Role Manager** | A non-admin member who holds `roles:manage` and/or `roles:assign`, so they can shape the school's RBAC without full admin powers. |
| **Member** | Any signed-in member whose permissions come from one or more assigned roles (teacher, staff, librarian, etc.). |
| **Invited Owner** | A user provisioned as the owner of a new school, holding an activation link. |

---

## Authentication

---

**US-T-AUTH-01 — Activate my membership and bootstrap the school** (replaces "register the first user")

> As an Invited Owner of a freshly created school,
> I want to open my activation link, set my password, and be signed in,
> so that I can start setting up the school.

Acceptance criteria:
- When the organization is created, the platform seeds the system roles and provisions my membership in the same transaction: `role = owner`, `isAdmin = true`, `status = pending`, plus the school's `admin` role. A single-use activation token (valid 7 days) is emailed to me after commit; the link carries the school slug.
- `GET /auth/activate?token=` validates the link and shows my email, name, and the organization.
- `POST /auth/activate` with `{ token, password }` (password ≥ 6 characters) sets my account password, marks my email verified, activates a `pending` account, sets my membership to `active`, consumes the token, and signs me in.
- The token only works on the school that issued it; a used, expired, or unknown token returns `400 Invalid or expired activation link`.
- There is no self-service `/auth/register` inside a school.

---

**US-T-AUTH-02 — Log in to a school**

> As a Member,
> I want to log in with my email and password on my school's address,
> so that I can access that school's workspace.

Acceptance criteria:
- I submit my email and password; the school comes from the `x-tenant-id` header, the subdomain, or a custom domain.
- My password is checked against my global account, then I must have a membership in this school. Wrong credentials and "not a member here" both return `401 Invalid credentials`, so the endpoint does not reveal which schools an email belongs to.
- On success I receive a JWT, my profile (`id`, `email`, `name`, `roles`, membership `status`, `isAdmin`), and an `organization` block (`id`, `slug`).
- The response includes my role names so the UI can render the right menu without an extra call.
- The token is bound to this school (`orgId` claim) and is rejected by every other school.
- The endpoint is rate-limited (5 requests per minute per client).

---

**US-T-AUTH-03 — View my own profile within a school**

> As a Member,
> I want to call `GET /auth/me`,
> so that I can see my own profile and the names of roles I hold in this school.

Acceptance criteria:
- I do not need to provide my own user id.
- The response includes my email, name, membership `status`, `isAdmin` flag, `membershipId`, and an array of role names.
- The password field is never returned.

---

**US-T-AUTH-04 — Change my own password**

> As a Member,
> I want to change my password by providing my current and a new password,
> so that I can rotate credentials without admin involvement.

Acceptance criteria:
- `POST /auth/change-password` (authenticated) with `currentPassword` and `newPassword` (≥ 6 characters).
- A wrong current password returns `400 Current password is incorrect`.
- The new password is hashed and replaces the old one. It is my global password, so it applies to every school I belong to.

---

**US-T-AUTH-05 — Request a password-reset link**

> As a Member who has forgotten their password,
> I want to receive a single-use reset link by email,
> so that I can regain access without contacting an admin.

Acceptance criteria:
- `POST /auth/forgot-password` with my email, in the school context.
- If the email belongs to a member of this school, a reset link valid for 1 hour is emailed.
- The response is always the same generic message, whether or not the email is known.

---

**US-T-AUTH-06 — Reset password via link**

> As a Member holding a valid reset token,
> I want to set a new password,
> so that I can log in again.

Acceptance criteria:
- `GET /auth/reset-password?token=` pre-checks the token without consuming it.
- `POST /auth/reset-password` with `{ token, password }` sets the new (global) password.
- The token is single-use, expires, and only works on the school that issued it.

---

## Members

---

**US-T-USER-01 — List members of my school**

> As a holder of `users:read` (or a School Admin),
> I want to list the members of my school,
> so that I can see who has access to the workspace.

Acceptance criteria:
- I receive every member of my school and nobody else's. Results are scoped to the organization by the repository layer and by row-level security.
- Each row shows the account (`id`, `email`, `name`, `emailVerifiedAt`), the membership (`membershipId`, `status`, `isAdmin`), and the assigned roles (`id`, `name`).
- I can filter by `id`, `name`, `email`, or `roleId` via query params.
- When I pass `roleId`, only members assigned that role are returned.
- A member without `users:read` and without `isAdmin` gets `403 Missing required permission: users:read`.

---

**US-T-USER-02 — Add a member with initial roles**

> As a holder of `users:create` (or a School Admin),
> I want to add a person to my school and optionally assign one or more roles at the same time,
> so that staff onboarding takes a single API call.

Acceptance criteria:
- I provide name, email, password, and optionally `roleIds` and `status` (a membership status).
- Each `roleId` must reference an existing role in this school; an unknown id fails the request before anything is created.
- If the email has no account yet, a global account is created with the password hashed (bcrypt, 10 rounds). If the account already exists (for example, the person works at another school), it is linked as-is and its password is not changed.
- If the person is already a member of this school, the request fails with `409 User is already a member of this organization`.
- If I omit `status`, the membership is created as `active`.

---

**US-T-USER-03 — View a member**

> As a holder of `users:read`,
> I want to fetch a member by user id,
> so that I can inspect their profile and current status.

Acceptance criteria:
- The response has the same shape as the list rows and never includes the password.
- An id that is not a member of this school returns `404`, even if the account exists elsewhere.

---

**US-T-USER-04 — Update a member's name or status**

> As a holder of `users:update`,
> I want to change a member's name or their status in this school,
> so that I can keep records current and suspend or deactivate members without removing them.

Acceptance criteria:
- I can submit any subset of `name` and `status`.
- `status` is the membership status and must be one of `pending | active | suspended | deactivated`. It affects this school only.
- `name` is stored on the global account, so the change is visible in every school the person belongs to.
- Other fields (email, password, `isAdmin`) cannot be modified via this endpoint.

---

**US-T-USER-05 — Remove a member from my school**

> As a holder of `users:delete`,
> I want to remove a person from my school,
> so that they no longer have access to it.

Acceptance criteria:
- The person's role assignments in this school are deleted, then their membership is deleted.
- Their global account and their memberships in other schools are untouched.
- Their JWT remains valid until it expires, because tokens are not re-checked against the membership (see US-T-USER-10 and US-T-AUTH-08).

---

**US-T-USER-06 — Promote another member to school admin**

> As a School Admin,
> I want to set `isAdmin = true` on another member via `POST /users/:id/grant-admin`,
> so that they can help co-administer the school.

Acceptance criteria:
- Only callers whose token has `isAdmin = true` can call this endpoint (no permission key gates it; only `IsAdminGuard`).
- Non-admin callers get `403 Admin only`.
- Already-admin members are a no-op.
- The flag is stored on the membership in this school only. The promoted member gets the bypass once they obtain a new token (next login).

---

**US-T-USER-07 — Revoke school admin from another member**

> As a School Admin,
> I want to call `POST /users/:id/revoke-admin`,
> so that I can remove the RBAC bypass from a member without removing them.

Acceptance criteria:
- Only admins can call.
- The member keeps their roles and continues to operate through assigned permissions only.
- Already-non-admin members are a no-op.
- The bypass stays in any token the member already holds until it expires (see US-T-PERM-07).

---

## Roles

---

**US-T-ROLE-01 — List roles in my school**

> As a holder of `roles:read`,
> I want to list every role in my school,
> so that I can see which roles exist and which are system-seeded.

Acceptance criteria:
- Results are ordered alphabetically by `name`.
- Each row includes `name`, `description`, `permissions[]`, and `isSystem`.
- The eight seeded roles (`admin`, `staff`, `teacher`, `accountant`, `librarian`, `parent`, `student`, `stakeholder`) exist in every school; each school has its own copies.

---

**US-T-ROLE-02 — View the permission catalog**

> As a holder of `roles:read`,
> I want to call `GET /permissions`,
> so that I can render a role editor with all the permissible actions grouped by resource.

Acceptance criteria:
- The response is grouped by resource: `[{ resource, permissions: [{ key, action }] }]`.
- The catalog is the **single source of truth**; it is code-defined and shared by all schools.

---

**US-T-ROLE-03 — View a single role**

> As a holder of `roles:read`,
> I want to fetch a role by id,
> so that I can see its current permission list.

Acceptance criteria:
- An id that does not exist in this school returns `404`.

---

**US-T-ROLE-04 — Create a custom role**

> As a holder of `roles:manage`,
> I want to create a custom role with a name, optional description, and a list of permissions,
> so that I can model school-specific responsibilities (e.g., "reviewer", "head_teacher").

Acceptance criteria:
- Name must be 2–64 characters; description ≤ 255 characters.
- Permissions are validated against the catalog; any unknown key returns `Unknown permission(s): <list>`.
- A name already used in this school returns `Role "<name>" already exists`. Other schools may use the same name.
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
- Submitted permissions are de-duplicated and validated against the catalog.

---

**US-T-ROLE-06 — Replace a role's permission list**

> As a holder of `roles:manage`,
> I want to `PUT /roles/:id/permissions` with the full desired list,
> so that the role editor can save a snapshot in a single request without first reading the current list.

Acceptance criteria:
- The body is a `permissions: string[]` array.
- The full list is replaced; unspecified keys are removed.
- Unknown keys are rejected with `400 Unknown permission(s): <list>`.
- The endpoint works on system roles too (their permission lists are editable; only name and existence are locked).

---

**US-T-ROLE-07 — Delete a custom role**

> As a holder of `roles:manage`,
> I want to delete a role I created,
> so that I can remove obsolete role definitions.

Acceptance criteria:
- Deleting a system role returns `403 System roles cannot be deleted`.
- If the role is assigned to any members, the request returns `409 Role is assigned to N user(s). Pass ?force=true to delete it and remove those assignments.`
- Passing `?force=true` deletes the role and its assignments (FK `ON DELETE CASCADE` on `user_roles.role_id`); the endpoint returns `204 No Content`.

---

## Role Assignments

---

**US-T-ASSIGN-01 — See which roles a member holds**

> As a holder of `roles:read`,
> I want to call `GET /users/:userId/roles`,
> so that I can see exactly which roles are assigned to a given member in this school.

Acceptance criteria:
- The response is a list of full role objects (including their permission arrays).
- Only this school's assignments are returned, even if the person holds roles in other schools.
- An empty list is returned if the user holds no roles here.

---

**US-T-ASSIGN-02 — Assign a role to a member**

> As a holder of `roles:assign`,
> I want to `POST /users/:userId/roles` with `{ roleId }`,
> so that the member gains that role's permissions on the next request.

Acceptance criteria:
- A role id that does not exist in this school returns `404`.
- A user who is not a member of this school returns `404 User with id "<id>" not found`.
- Re-assigning the same role is a no-op (checked first, and backed by the unique index on `user_roles(org_id, user_id, role_id)`).
- After assignment, the member's effective permissions are the **union** of every assigned role's permissions, starting with their next request.

---

**US-T-ASSIGN-03 — Revoke a role from a member**

> As a holder of `roles:assign`,
> I want to `DELETE /users/:userId/roles/:roleId`,
> so that the member loses that role's permissions.

Acceptance criteria:
- A role id that does not exist in this school returns `404`.
- If the role is `admin` and no **other** member of this school holds it, the request returns `409 Cannot remove the last admin role assignment`, so the school is not locked out of administration.
- Removing an assignment that does not exist is silently a no-op (except for the `admin` check above).

---

**US-T-ASSIGN-04 — Effective permissions are resolved fresh per request**

> As a Role Manager,
> I want changes to a role's permissions or a member's role assignments to take effect immediately,
> so that I don't have to ask members to log out and back in after I edit their access.

Acceptance criteria:
- `PermissionResolverService.getEffectivePermissions(userId)` runs on every request to a route with `@RequirePermissions` (for non-admins).
- It loads the member's `UserRole` rows in this school, then unions the `permissions` arrays of each role.
- Updating a role's permission list (`PATCH /roles/:id` or `PUT /roles/:id/permissions`) changes what every assigned member can do on their **next** request; there is no cache to invalidate.
- This does not apply to the school-admin flag, which travels in the token (see US-T-PERM-07).

---

## Permission Enforcement

---

**US-T-PERM-01 — School Admin bypass**

> As a School Admin,
> I want my requests to bypass `PermissionsGuard` checks,
> so that I can administer the school without first granting myself the matching role.

Acceptance criteria:
- Any handler decorated with `@RequirePermissions(...)` allows the request when `request.user.isAdmin === true`.
- `isAdmin` comes from my membership in this school and is carried in my token.
- Admin-only `IsAdminGuard` routes (e.g., `grant-admin`) require the flag; holding the `admin` role is not enough.
- The bypass is per school: a token issued for `acme` is rejected by `beta` (`401 Token does not belong to this organization`), so my admin status in `acme` never applies in `beta`.

---

**US-T-PERM-02 — Pass with one of multiple required permissions (OR semantics)**

> As a holder of either of two interchangeable permissions,
> I want a route decorated with `@RequirePermissions(A, B)` to accept me,
> so that endpoints that can be reached from multiple capabilities don't need bespoke guard code.

Acceptance criteria:
- A member holding **either** `A` **or** `B` is allowed.
- A member holding neither receives `403 Missing required permission: A or B`.

---

**US-T-PERM-03 — Clear 403 on missing permission**

> As a Member without the required permission,
> I want a clear 403 response,
> so that the UI can show me a meaningful error rather than guessing why the call failed.

Acceptance criteria:
- The exception message lists the required permission keys joined by ` or `.
- The HTTP status is `403`.
- The guard runs before the handler, so no partial writes occur.

---

**US-T-PERM-04 — Unauthenticated requests are rejected before RBAC**

> As an unauthenticated caller,
> I want to receive `401` for any RBAC-protected route,
> so that the distinction between "unauthenticated" and "missing permission" is clear.

Acceptance criteria:
- `JwtAuthGuard` runs first and rejects with `401` if the token is missing, invalid, expired, or issued for another school (or by the platform).
- `PermissionsGuard` runs second; if `request.user` has no `userId` it throws `401 Authentication required`.

---

**US-T-PERM-05 — School context must be present**

> As a caller of any tenanted route,
> I want my request rejected when the school context is missing or invalid,
> so that I cannot accidentally execute queries against the wrong school.

Acceptance criteria:
- The school is resolved from the `x-tenant-id` header (a slug), else from the subdomain, else from a custom domain.
- An `x-tenant-id` slug that fails the `^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$` pattern or does not exist → `404 TenantNotFoundException`.
- No header, and neither the subdomain nor the host matches a school → `400 TenantContextMissingException`.
- The school exists but its status is not `active` → `403 TenantInactiveException`.
- These checks happen in `TenantMiddleware`, **before** any auth or permission guard runs. Platform routes (`organizations`, `memberships`, `platform/*`, `public`, `health`, `dev/mail`) are excluded.

---

**US-T-PERM-06 — School data is isolated from other schools**

> As a School Admin,
> I want my school's data to be invisible and unwritable from any other school,
> so that sharing one database with other schools never leaks our records.

Acceptance criteria:
- Every school-owned table carries `org_id`. Repositories pin reads, writes, updates and deletes to the request's school, and a write naming another school fails with `403 Cross-organization write blocked`.
- Postgres row-level security (`org_isolation` policy) compares `org_id` with the connection's `app.org_id` setting, so even a query that skips the repository scoping returns no rows from other schools. With no setting, no rows are visible.
- Unique names (such as role names) are unique per school, not globally.
- Deleting a school deletes all of its rows (cascading FK to `organizations`).

---

---

## Suggested Stories — Missing or Not Yet Implemented

The stories below describe functionality that is absent from, or only partly present in, the current tenant code. Each is marked with a status tag so the team can prioritise them.

> **Status tags**
> - `[NOT IMPLEMENTED]` — feature is completely absent; no endpoint or service method exists
> - `[PARTIAL]` — related data or logic exists but the specific behaviour is not exposed or enforced

---

### Authentication

---

**US-T-AUTH-07 — Refresh an expiring access token** `[NOT IMPLEMENTED]`

> As a Member,
> I want to exchange a near-expiry token for a new one,
> so that my session stays active during long working sessions.

Acceptance criteria:
- A dedicated refresh endpoint accepts a non-expired token and issues a new one.
- Expired tokens cannot be refreshed.
- The new token reflects my current membership (`isAdmin`, status).

---

**US-T-AUTH-08 — Log out and invalidate the current token** `[NOT IMPLEMENTED]`

> As a Member,
> I want to log out,
> so that my token cannot be reused.

Acceptance criteria:
- Calling the logout endpoint adds my JWT to a denylist (or rotates a per-user token version).
- Subsequent requests with the same token are rejected.
- Note: JWTs are currently stateless, so this requires either a denylist or a refresh-token mechanism.

---

**US-T-AUTH-09 — Verify email after joining a school** `[PARTIAL]`

> As a new Member,
> I want to verify my email after my account is created,
> so that the school can confirm the address belongs to me.

Acceptance criteria:
- A verification email is sent automatically when a new account is created through `POST /users`.
- Unverified accounts may have limited access until verification.
- Note: `GET/POST /auth/verify-email` and `POST /auth/resend-verification` exist, and activation marks the email verified, but `POST /users` never sends a verification email and verification is not enforced anywhere.

---

### Members

---

**US-T-USER-08 — Search members by partial name or email** `[NOT IMPLEMENTED]`

> As a holder of `users:read`,
> I want to search members by partial name or email,
> so that I can find people without scrolling through a long list.

Acceptance criteria:
- `name` and `email` query params accept partial, case-insensitive matches.
- Today these filters use exact match only.

---

**US-T-USER-09 — Paginate the member list** `[NOT IMPLEMENTED]`

> As a holder of `users:read`,
> I want `GET /users` to return paginated results,
> so that large schools don't return thousands of records in one response.

Acceptance criteria:
- I can pass `page` and `pageSize` (or similar) query params.
- The response includes total count, current page, and the data slice.

---

**US-T-USER-10 — Status changes restrict access immediately** `[PARTIAL]`

> As a School Admin,
> I want members whose membership or account is no longer active to lose access right away,
> so that suspending someone takes effect without waiting for their token to expire.

Acceptance criteria:
- Login is refused for `suspended | deactivated | banned` accounts and for non-`active` memberships (`pending` gets a "please activate" message).
- Requests with an existing token are refused once the membership is suspended, deactivated, or removed.
- Note: login enforces both checks today, but `JwtStrategy` does not re-check the membership or account, so existing tokens keep working until they expire.

---

**US-T-USER-11 — Invite a member by email** `[PARTIAL]`

> As a holder of `users:create`,
> I want to invite someone by email and let them choose their own password,
> so that I never have to set or share a password for them.

Acceptance criteria:
- Adding a member without a password creates a `pending` membership and emails an activation link.
- The invitee activates through `/auth/activate` as in US-T-AUTH-01.
- Note: the activation flow and `pending` membership status exist, but only owner provisioning issues activation tokens; `POST /users` requires the admin to supply a password and creates an `active` membership.

---

**US-T-USER-12 — Protect the owner and the last school admin** `[NOT IMPLEMENTED]`

> As a School Admin,
> I want the system to stop anyone from removing the school's owner or its last admin,
> so that the school can never be left without an administrator.

Acceptance criteria:
- `DELETE /users/:id` refuses to remove the owner membership and the last member with `isAdmin` or the `admin` role.
- `revoke-admin` refuses to clear the flag on the last school admin (including on oneself).
- Note: the only safeguard today is the last-`admin`-role check in `DELETE /users/:userId/roles/:roleId`. `DELETE /users/:id` removes all role assignments directly, and `revoke-admin` has no check.

---

### Roles & Permissions

---

**US-T-ROLE-08 — View my own effective permissions** `[NOT IMPLEMENTED]`

> As a Member,
> I want to call `GET /auth/me/permissions` (or similar),
> so that the UI can disable buttons for actions I cannot perform without trial-and-error 403s.

Acceptance criteria:
- The response is a flat list of permission keys.
- For an admin, the response includes the special marker `*` (or the full catalog) to indicate the bypass.
- Note: `PermissionResolverService.getEffectivePermissions` already computes this; it is just not exposed via any controller. `GET /auth/me` returns role names only.

---

**US-T-ROLE-09 — Require ALL permissions instead of ANY** `[PARTIAL]`

> As a developer writing a particularly sensitive endpoint,
> I want a `@RequireAllPermissions(...)` decorator,
> so that the route demands the intersection rather than the union of required keys.

Acceptance criteria:
- A new decorator + guard semantics that pass only when the member holds **every** listed key.
- Note: `PermissionsGuard` today is hard-coded to OR semantics (`required.some(...)`).

---

**US-T-ROLE-10 — Role hierarchy / inheritance** `[NOT IMPLEMENTED]`

> As a School Admin,
> I want to declare that role A inherits from role B,
> so that I can compose roles without duplicating permission lists.

Acceptance criteria:
- A role definition can optionally reference one or more parent roles.
- Effective permissions are computed transitively.
- Note: today roles are a flat union of permission keys; there is no parent relation on `Role`.

---

**US-T-ROLE-11 — Audit log of role and permission changes** `[NOT IMPLEMENTED]`

> As a School Admin,
> I want every role creation, permission change, and assignment to be recorded,
> so that I can investigate "who granted X this permission" after the fact.

Acceptance criteria:
- An append-only, org-scoped audit table records actor, action, target, before / after states, timestamp.
- The log is visible to admins via a dedicated endpoint.

---

**US-T-ROLE-12 — Localised role descriptions** `[NOT IMPLEMENTED]`

> As an end user,
> I want role names and descriptions surfaced in the UI to be localised,
> so that non-English schools can present them in their language.

Acceptance criteria:
- Seeded role descriptions are i18n keys (or have an i18n table) rather than free English text.
- Custom roles can carry per-locale descriptions.

---

**US-T-ROLE-13 — New catalog keys reach existing schools' system roles** `[NOT IMPLEMENTED]`

> As a School Admin of an existing school,
> I want seeded roles like `staff` and `teacher` to gain permissions for newly released features,
> so that my staff can use new modules without me editing every role by hand.

Acceptance criteria:
- A back-fill (migration or command) adds new default keys to existing schools' system roles without overwriting edits the school made.
- Note: `RbacSeederService.seedSystemRoles` only inserts missing roles; it never updates the permission lists of roles that already exist.

---

### Assignments

---

**US-T-ASSIGN-05 — Self-leave a role** `[NOT IMPLEMENTED]`

> As a Member,
> I want to remove a role from myself (subject to safeguards),
> so that I can voluntarily give up elevated access I no longer need.

Acceptance criteria:
- I cannot remove my own last `admin` role assignment (same safeguard as `roles:assign`).
- I cannot remove someone else's role assignment this way.

---

**US-T-ASSIGN-06 — Bulk-assign or bulk-revoke** `[NOT IMPLEMENTED]`

> As a holder of `roles:assign`,
> I want to apply a role to many members (or many roles to one member) in a single request,
> so that bulk onboarding doesn't require N round-trips.

Acceptance criteria:
- A dedicated endpoint accepts `{ userIds: UUID[], roleId }` or `{ userId, roleIds: UUID[] }`.
- Validation is up-front: any invalid id rejects the whole request.

---

### Permission Enforcement

---

**US-T-PERM-07 — Admin-flag changes take effect immediately** `[PARTIAL]`

> As a School Admin,
> I want granting or revoking school admin to apply on the member's next request,
> so that removing someone's bypass is not delayed until their token expires.

Acceptance criteria:
- `PermissionsGuard` and `IsAdminGuard` read the current `memberships.is_admin` (or the token is invalidated when it changes).
- Note: role permissions are resolved fresh per request, but `isAdmin` is copied into the JWT at sign-in and read from there.

---

---

## Story Map Summary

```
Tenanted RBAC
│
├── Authentication
│   ├── US-T-AUTH-01  Activate membership (owner bootstrap)      [Invited Owner]
│   ├── US-T-AUTH-02  Log in to school                          [Any]
│   ├── US-T-AUTH-03  View own profile                          [Any]
│   ├── US-T-AUTH-04  Change own password                       [Any]
│   ├── US-T-AUTH-05  Request password-reset link               [Any]
│   ├── US-T-AUTH-06  Reset password via link                   [Any]
│   ├── US-T-AUTH-07  Refresh access token                       [NOT IMPLEMENTED]
│   ├── US-T-AUTH-08  Log out / invalidate token                 [NOT IMPLEMENTED]
│   └── US-T-AUTH-09  Verify email after joining                 [PARTIAL]
│
├── Members
│   ├── US-T-USER-01  List members                              [users:read]
│   ├── US-T-USER-02  Add member with initial roles             [users:create]
│   ├── US-T-USER-03  View member                               [users:read]
│   ├── US-T-USER-04  Update name / membership status           [users:update]
│   ├── US-T-USER-05  Remove member from school                 [users:delete]
│   ├── US-T-USER-06  Grant school admin                        [School Admin]
│   ├── US-T-USER-07  Revoke school admin                       [School Admin]
│   ├── US-T-USER-08  Search by partial name / email             [NOT IMPLEMENTED]
│   ├── US-T-USER-09  Paginate member list                       [NOT IMPLEMENTED]
│   ├── US-T-USER-10  Status changes restrict access immediately [PARTIAL]
│   ├── US-T-USER-11  Invite member by email                     [PARTIAL]
│   └── US-T-USER-12  Protect owner and last school admin        [NOT IMPLEMENTED]
│
├── Roles
│   ├── US-T-ROLE-01  List roles                                [roles:read]
│   ├── US-T-ROLE-02  View permission catalog                   [roles:read]
│   ├── US-T-ROLE-03  View single role                          [roles:read]
│   ├── US-T-ROLE-04  Create custom role                        [roles:manage]
│   ├── US-T-ROLE-05  Update name / description / permissions   [roles:manage]
│   ├── US-T-ROLE-06  Replace permissions (PUT)                 [roles:manage]
│   ├── US-T-ROLE-07  Delete role (with ?force=true)            [roles:manage]
│   ├── US-T-ROLE-08  View own effective permissions             [NOT IMPLEMENTED]
│   ├── US-T-ROLE-09  Require ALL permissions instead of ANY     [PARTIAL]
│   ├── US-T-ROLE-10  Role hierarchy / inheritance               [NOT IMPLEMENTED]
│   ├── US-T-ROLE-11  Audit log of role changes                  [NOT IMPLEMENTED]
│   ├── US-T-ROLE-12  Localised role descriptions                [NOT IMPLEMENTED]
│   └── US-T-ROLE-13  Back-fill new keys into system roles       [NOT IMPLEMENTED]
│
├── Assignments
│   ├── US-T-ASSIGN-01  List member's roles                     [roles:read]
│   ├── US-T-ASSIGN-02  Assign role to member                   [roles:assign]
│   ├── US-T-ASSIGN-03  Revoke role (last-admin safeguard)      [roles:assign]
│   ├── US-T-ASSIGN-04  Effective permissions fresh per request [Any]
│   ├── US-T-ASSIGN-05  Self-leave a role                        [NOT IMPLEMENTED]
│   └── US-T-ASSIGN-06  Bulk-assign or bulk-revoke               [NOT IMPLEMENTED]
│
└── Permission Enforcement
    ├── US-T-PERM-01  School Admin bypass                        [School Admin]
    ├── US-T-PERM-02  OR semantics across required permissions  [Any]
    ├── US-T-PERM-03  Clear 403 on missing permission            [Any]
    ├── US-T-PERM-04  Reject unauthenticated requests early      [Any]
    ├── US-T-PERM-05  Reject missing / invalid school context    [Any]
    ├── US-T-PERM-06  Data isolated between schools              [Any]
    └── US-T-PERM-07  Admin-flag changes take effect immediately [PARTIAL]
```
