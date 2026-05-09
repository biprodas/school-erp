# Platform Admin — User Stories

These stories cover the platform-level administration layer: account registration, tenant (school) management, and membership (access control). They are written from the perspective of two actor types.

**Actors**

| Actor | Who they are |
|---|---|
| **Super Admin** | The platform operator. Manages all schools and all users across the system. |
| **School Owner** | A user who creates and owns one or more schools on the platform. |

---

## Authentication

---

**US-AUTH-01 — Register a platform account**

> As a new user,
> I want to create a platform account with my name, email, and password,
> so that I can log in and manage schools.

Acceptance criteria:
- I can submit first name, last name, email, and a password (minimum 6 characters).
- If the email is already in use, I see an error and am not registered twice.
- On success, I receive an access token and am immediately logged in.

---

**US-AUTH-02 — Log in to my platform account**

> As a registered user,
> I want to log in with my email and password,
> so that I can access the platform.

Acceptance criteria:
- I submit my email and password.
- If the credentials are correct and my account is active, I receive an access token.
- If the credentials are wrong, I see an error message.
- If my account has been deactivated, I cannot log in.

---

**US-AUTH-03 — View my own profile**

> As a logged-in user,
> I want to see my profile information,
> so that I can verify my details and see which schools I belong to.

Acceptance criteria:
- I can fetch my profile without providing my ID.
- The response includes my name, email, role, and a list of my school memberships.

---

## Users

---

**US-USER-01 — Create a platform user (admin action)**

> As a Super Admin,
> I want to create platform accounts for other users,
> so that I can onboard operators or school owners without them self-registering.

Acceptance criteria:
- I can specify first name, last name, email, password, and optionally assign a platform role.
- The new user receives a hashed password (not stored in plain text).
- Duplicate emails are rejected.

---

**US-USER-02 — List all platform users**

> As a Super Admin,
> I want to see a list of all registered platform users,
> so that I can audit who has access to the system.

Acceptance criteria:
- I can retrieve all users in one request.
- Regular users cannot access this list.

---

**US-USER-03 — View a specific user**

> As a Super Admin or the user themselves,
> I want to view a user's profile by their ID,
> so that I can inspect their details.

Acceptance criteria:
- A Super Admin can view any user.
- A regular user can only view their own profile.
- Requesting another user's profile as a regular user is rejected.

---

**US-USER-04 — Update my own profile**

> As a logged-in user,
> I want to update my first name or last name,
> so that my profile stays accurate.

Acceptance criteria:
- I can change my own first and last name.
- I cannot change my own platform role or active status — those fields are ignored if I send them.

---

**US-USER-05 — Promote or deactivate a user (admin action)**

> As a Super Admin,
> I want to change a user's platform role or deactivate their account,
> so that I can manage who has elevated access or revoke platform access without deleting the account.

Acceptance criteria:
- I can set another user's `role` to `super_admin` or `user`.
- I can set `isActive` to `false` to prevent login without deleting their data.
- Regular users cannot perform these actions on anyone, including themselves.

---

**US-USER-06 — Delete a platform user**

> As a Super Admin,
> I want to permanently delete a user account,
> so that I can remove users who should no longer exist in the system.

Acceptance criteria:
- The user record is removed.
- Any memberships belonging to that user are also removed automatically.
- Only a Super Admin can perform this action.

---

## Tenants (Schools)

---

**US-TENANT-01 — Create a new school**

> As a logged-in user,
> I want to create a new school on the platform,
> so that I can set up a workspace for my institution.

Acceptance criteria:
- I provide a school name, a unique slug (short URL-friendly identifier), and optionally a custom domain.
- The system provisions a dedicated data space for that school automatically.
- I am automatically assigned as the Owner of the school.
- A Super Admin creating a school is not automatically assigned as owner (they manage the platform globally).

---

**US-TENANT-02 — View my schools**

> As a logged-in user,
> I want to see the list of schools I belong to,
> so that I know which workspaces I can access.

Acceptance criteria:
- I only see schools where I have a membership (owner, admin, or member).
- A Super Admin sees all schools on the platform.

---

**US-TENANT-03 — View a school's details**

> As a member of a school or a Super Admin,
> I want to view a school's details by its ID,
> so that I can inspect its name, slug, domain, and status.

Acceptance criteria:
- A Super Admin can view any school.
- A regular user can only view schools they are a member of.
- Requesting a school the user has no membership in is rejected.

---

**US-TENANT-04 — Update a school**

> As the Owner of a school or a Super Admin,
> I want to update the school's name, domain, or status,
> so that I can keep the school's information current.

Acceptance criteria:
- Only the school's Owner or a Super Admin can make changes.
- The slug and internal schema name cannot be changed after creation.
- Valid status transitions include activating, suspending, or archiving a school.
- Admins and Members cannot edit school settings.

---

**US-TENANT-05 — Delete a school**

> As a Super Admin,
> I want to permanently delete a school,
> so that I can remove institutions that are no longer using the platform.

Acceptance criteria:
- Only a Super Admin can delete a school.
- All data stored in that school's dedicated data space is permanently destroyed.
- All memberships associated with the school are removed automatically.
- This action is irreversible.

---

## Memberships

---

**US-MEMBER-01 — Invite a user to a school (admin action)**

> As a Super Admin,
> I want to add an existing platform user to a school with a specific role,
> so that they can access that school's workspace.

Acceptance criteria:
- I specify the user ID, the school ID, and a role (`owner`, `admin`, or `member`).
- A user cannot be added to the same school twice — a duplicate is rejected.
- The school must exist; an invalid school ID is rejected.

---

**US-MEMBER-02 — View members of a school**

> As an authenticated user,
> I want to see all members of a specific school,
> so that I know who has access to it.

Acceptance criteria:
- I provide the school's ID and receive a list of memberships including user details and roles.
- Results are ordered by when each membership was created.

---

**US-MEMBER-03 — View all schools a user belongs to**

> As an authenticated user,
> I want to look up all schools a given user is a member of,
> so that I can understand their access across the platform.

Acceptance criteria:
- I provide a user ID and receive their membership list including school details and roles.
- Results are ordered by when each membership was created.

---

**US-MEMBER-04 — Look up a specific membership**

> As an authenticated user,
> I want to retrieve a membership record by its ID,
> so that I can see the exact role a user holds in a school.

Acceptance criteria:
- I provide a membership ID and receive the full membership record.
- A not-found error is returned if the ID does not exist.

---

**US-MEMBER-05 — Change a member's role (admin action)**

> As a Super Admin,
> I want to change the role of an existing membership,
> so that I can promote a member to admin or demote an admin to member.

Acceptance criteria:
- I provide the membership ID and the new role.
- Only `owner`, `admin`, and `member` are valid role values.
- Only a Super Admin can change roles.

---

**US-MEMBER-06 — Remove a user from a school (admin action)**

> As a Super Admin,
> I want to remove a user's membership from a school,
> so that they can no longer access that school's workspace.

Acceptance criteria:
- The membership record is permanently deleted.
- The user's platform account is not affected.
- Only a Super Admin can remove memberships.

---

---

## Suggested Stories — Missing or Not Yet Implemented

The stories below describe functionality that is absent from the current codebase. Each one is marked with a status tag so the team can prioritise them.

> **Status tags**
> - `[NOT IMPLEMENTED]` — feature is completely absent; no endpoint or service method exists
> - `[PARTIAL]` — related data/logic exists but the specific behaviour is not exposed or enforced

---

### Authentication

---

**US-AUTH-04 — Log out and invalidate the current session** `[NOT IMPLEMENTED]`

> As a logged-in user,
> I want to log out,
> so that my access token is no longer valid and my session is closed.

Acceptance criteria:
- Calling the logout endpoint makes the current token unusable.
- Subsequent requests with the old token are rejected.
- Note: JWTs are currently stateless; a token denylist or short-lived refresh-token mechanism is needed.

---

**US-AUTH-05 — Refresh an expiring access token** `[NOT IMPLEMENTED]`

> As a logged-in user,
> I want to exchange a near-expiry token for a new one without re-entering my password,
> so that my session stays active during long working sessions.

Acceptance criteria:
- A dedicated refresh endpoint accepts a valid (non-expired) token and returns a new one.
- The old token is invalidated upon refresh.
- Expired tokens cannot be refreshed.

---

**US-AUTH-06 — Request a password reset link** `[NOT IMPLEMENTED]`

> As a user who has forgotten their password,
> I want to request a reset link sent to my registered email address,
> so that I can regain access to my account without contacting support.

Acceptance criteria:
- I submit my email address.
- If the email is registered, a time-limited reset link is sent.
- If the email is not registered, the response gives no indication (security best practice).
- The reset link expires after a set period (e.g., 1 hour).

---

**US-AUTH-07 — Reset password using a link** `[NOT IMPLEMENTED]`

> As a user who requested a password reset,
> I want to set a new password using the link I received,
> so that I can log in again.

Acceptance criteria:
- The reset link contains a single-use token.
- I can submit a new password (minimum 6 characters).
- After reset, the token is invalidated and cannot be reused.
- I can log in immediately with the new password.

---

**US-AUTH-08 — Verify email address after registration** `[NOT IMPLEMENTED]`

> As a newly registered user,
> I want to verify my email address,
> so that the platform can confirm I own the address I signed up with.

Acceptance criteria:
- After registration, a verification email is sent.
- Clicking the link marks my account as email-verified.
- Unverified accounts may have limited access (e.g., cannot create schools) until verified.

---

### Users

---

**US-USER-07 — Change my own password** `[NOT IMPLEMENTED]`

> As a logged-in user,
> I want to change my password by providing my current password and a new one,
> so that I can update my credentials without admin involvement.

Acceptance criteria:
- I provide my current password and a new password (minimum 6 characters).
- If the current password is wrong, the change is rejected.
- The new password is hashed and stored; old password no longer works.
- I do not need to re-enter my current password if I am a Super Admin changing another user's password.

---

**US-USER-08 — Change my email address** `[NOT IMPLEMENTED]`

> As a logged-in user,
> I want to update my email address,
> so that my login credential stays current.

Acceptance criteria:
- I provide my new email address and confirm my current password.
- If the new email is already in use by another account, the change is rejected.
- A verification email is sent to the new address before the change takes effect.

---

**US-USER-09 — Search and filter platform users** `[NOT IMPLEMENTED]`

> As a Super Admin,
> I want to search users by name, email, role, or active status,
> so that I can find specific accounts quickly without scrolling through the full list.

Acceptance criteria:
- I can filter by partial name or email (case-insensitive).
- I can filter by `role` and/or `isActive`.
- Results are paginated.

---

**US-USER-10 — Paginate the user list** `[NOT IMPLEMENTED]`

> As a Super Admin,
> I want the user list to be paginated,
> so that the API does not return thousands of records in one response as the platform grows.

Acceptance criteria:
- I can specify a page number and page size.
- The response includes total count, current page, and the data slice.

---

**US-USER-11 — Reactivate a deactivated account** `[PARTIAL]`

> As a Super Admin,
> I want to reactivate a previously deactivated user account,
> so that a user who was temporarily suspended can regain access.

Acceptance criteria:
- Setting `isActive` to `true` on a deactivated user re-enables their login.
- This is a distinct action from deletion and should be confirmable.
- Note: The `PATCH /platform/users/:id` endpoint technically allows this today via `isActive: true`, but there is no explicit "reactivate" path or confirmation flow.

---

### Schools (Tenants)

---

**US-TENANT-06 — Look up a school by its slug** `[NOT IMPLEMENTED]`

> As an authenticated user or system,
> I want to retrieve a school's details using its slug,
> so that I can resolve a URL-friendly identifier to a full school record.

Acceptance criteria:
- I provide a slug and receive the matching school record.
- A not-found error is returned if no school has that slug.
- Note: `findBySlug` exists in `TenantService` but is not exposed via any controller route.

---

**US-TENANT-07 — Filter schools by status** `[NOT IMPLEMENTED]`

> As a Super Admin,
> I want to filter the school list by status (e.g., active, suspended, archived),
> so that I can quickly audit schools in a particular state.

Acceptance criteria:
- I can pass an optional status filter to the list endpoint.
- Only schools matching the status are returned.
- Without a filter, all schools are returned (existing behaviour).

---

**US-TENANT-08 — Transfer school ownership to another member** `[NOT IMPLEMENTED]`

> As the Owner of a school,
> I want to transfer ownership to another existing member,
> so that someone else can take over administration of the school.

Acceptance criteria:
- I can designate another current member of the school as the new Owner.
- My own role is downgraded to Admin (or Member) on transfer.
- There can only be one Owner per school at any time.
- Super Admin can also perform this transfer.

---

**US-TENANT-09 — Suspend or archive a school** `[PARTIAL]`

> As a Super Admin,
> I want to suspend or archive a school,
> so that I can disable access without permanently destroying the data.

Acceptance criteria:
- Setting status to `suspended` prevents tenant-level logins for that school.
- Setting status to `archived` marks the school as read-only/inactive for historical records.
- The school's data and schema are preserved in both cases.
- Note: The `status` field and `TenantStatus` enum exist, but no login guard currently checks tenant status before granting access.

---

**US-TENANT-10 — Paginate the school list** `[NOT IMPLEMENTED]`

> As a Super Admin,
> I want the school list to be paginated,
> so that large deployments with many schools remain performant.

Acceptance criteria:
- I can specify a page number and page size.
- The response includes total count, current page, and the data slice.

---

### Memberships

---

**US-MEMBER-07 — School Owner invites a user to their school** `[NOT IMPLEMENTED]`

> As the Owner of a school,
> I want to add an existing platform user to my school,
> so that I can manage my school's team without requiring Super Admin involvement.

Acceptance criteria:
- An Owner can add users with roles of `admin` or `member` (not `owner`).
- The user must already have a platform account.
- Duplicate memberships are rejected.
- Note: Currently only Super Admins can create memberships. Owners have no self-service path.

---

**US-MEMBER-08 — School Admin manages memberships within their school** `[NOT IMPLEMENTED]`

> As an Admin of a school,
> I want to add and remove members from my school,
> so that day-to-day team management does not require escalating to the platform operator.

Acceptance criteria:
- An Admin can add users as `member` (not `admin` or `owner`).
- An Admin can remove `member`-level memberships.
- An Admin cannot change or remove another Admin's membership or the Owner's membership.

---

**US-MEMBER-09 — Leave a school** `[NOT IMPLEMENTED]`

> As a member or admin of a school,
> I want to remove myself from the school,
> so that I can voluntarily give up access without waiting for an admin action.

Acceptance criteria:
- I can delete my own membership.
- An Owner cannot leave a school they own — they must transfer ownership first.
- My platform account is not affected.

---

**US-MEMBER-10 — View my membership within a specific school** `[NOT IMPLEMENTED]`

> As a logged-in user,
> I want to see my own membership record for a given school,
> so that I can confirm my current role without fetching the full member list.

Acceptance criteria:
- I provide a school ID and receive my membership record (role, joined date).
- If I have no membership in that school, a not-found response is returned.
- Note: Today a user would need to call `GET /memberships/user/:userId` and filter client-side.

---

**US-MEMBER-11 — Enforce one Owner per school** `[NOT IMPLEMENTED]`

> As a platform rule,
> when a new member is assigned the Owner role,
> the previous Owner should be automatically downgraded,
> so that each school always has exactly one Owner.

Acceptance criteria:
- Assigning `owner` to a membership checks for an existing owner.
- The existing owner is demoted to `admin` (or a chosen role) automatically.
- This rule applies when creating a membership with role `owner` or when updating a role to `owner`.
- Note: Currently there is no guard against multiple Owners existing for the same school.

---

## Story Map Summary

```
Platform Admin
│
├── Authentication
│   ├── US-AUTH-01  Register account
│   ├── US-AUTH-02  Log in
│   ├── US-AUTH-03  View own profile
│   ├── US-AUTH-04  Log out / invalidate token          [NOT IMPLEMENTED]
│   ├── US-AUTH-05  Refresh access token                [NOT IMPLEMENTED]
│   ├── US-AUTH-06  Request password reset link         [NOT IMPLEMENTED]
│   ├── US-AUTH-07  Reset password via link             [NOT IMPLEMENTED]
│   └── US-AUTH-08  Verify email after registration     [NOT IMPLEMENTED]
│
├── Users
│   ├── US-USER-01  Create user                         [Super Admin]
│   ├── US-USER-02  List all users                      [Super Admin]
│   ├── US-USER-03  View user profile                   [Super Admin / Self]
│   ├── US-USER-04  Update own profile                  [Self]
│   ├── US-USER-05  Change role / deactivate            [Super Admin]
│   ├── US-USER-06  Delete user                         [Super Admin]
│   ├── US-USER-07  Change own password                 [NOT IMPLEMENTED]
│   ├── US-USER-08  Change email address                [NOT IMPLEMENTED]
│   ├── US-USER-09  Search and filter users             [NOT IMPLEMENTED]
│   ├── US-USER-10  Paginate user list                  [NOT IMPLEMENTED]
│   └── US-USER-11  Reactivate deactivated account      [PARTIAL]
│
├── Schools (Tenants)
│   ├── US-TENANT-01  Create school                     [Any authenticated user]
│   ├── US-TENANT-02  List my schools                   [Any authenticated user]
│   ├── US-TENANT-03  View school details               [Member / Super Admin]
│   ├── US-TENANT-04  Update school                     [Owner / Super Admin]
│   ├── US-TENANT-05  Delete school                     [Super Admin]
│   ├── US-TENANT-06  Look up school by slug            [NOT IMPLEMENTED]
│   ├── US-TENANT-07  Filter schools by status          [NOT IMPLEMENTED]
│   ├── US-TENANT-08  Transfer school ownership         [NOT IMPLEMENTED]
│   ├── US-TENANT-09  Suspend or archive a school       [PARTIAL]
│   └── US-TENANT-10  Paginate school list              [NOT IMPLEMENTED]
│
└── Memberships
    ├── US-MEMBER-01  Add user to school                 [Super Admin]
    ├── US-MEMBER-02  List school members                [Authenticated]
    ├── US-MEMBER-03  List user's schools                [Authenticated]
    ├── US-MEMBER-04  View membership                    [Authenticated]
    ├── US-MEMBER-05  Change member role                 [Super Admin]
    ├── US-MEMBER-06  Remove from school                 [Super Admin]
    ├── US-MEMBER-07  Owner invites user to school       [NOT IMPLEMENTED]
    ├── US-MEMBER-08  Admin manages school memberships   [NOT IMPLEMENTED]
    ├── US-MEMBER-09  Leave a school                     [NOT IMPLEMENTED]
    ├── US-MEMBER-10  View own membership in a school    [NOT IMPLEMENTED]
    └── US-MEMBER-11  Enforce one owner per school       [NOT IMPLEMENTED]
```
