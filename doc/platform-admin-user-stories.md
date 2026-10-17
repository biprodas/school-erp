# Platform Admin — User Stories

These stories cover the platform-level administration layer: account registration, school management, and membership (access control). In the code a school is an **organization** (`organizations` table, `/organizations` routes); this document says "school" and "organization" interchangeably. Technical details are in `platform-admin-module.md`.

**Actors**

| Actor | Who they are |
|---|---|
| **Super Admin** | The platform operator (a user with the platform admin flag). Manages all schools, all user accounts and all memberships. |
| **School Owner** | A user who holds the Owner membership of a school, usually because they created it. |
| **Platform user** | Anyone with a platform account. One account (one email and password) works across every school they belong to. |

---

## Authentication

---

**US-AUTH-01 — Register a platform account**

> As a new user,
> I want to create a platform account with my name, email, and password,
> so that I can log in and manage schools.

Acceptance criteria:
- I can submit my name, email, and a password (minimum 6 characters).
- If the email is already in use, I see an error and am not registered twice.
- On success, my account is pending and a verification email is sent; I am not logged in until I verify (see US-AUTH-08).

---

**US-AUTH-02 — Log in to my platform account**

> As a registered user,
> I want to log in with my email and password,
> so that I can access the platform.

Acceptance criteria:
- I submit my email and password.
- If the credentials are correct and my account is active, I receive an access token.
- If the credentials are wrong, I see a generic "invalid credentials" error.
- If I have not verified my email yet, I am told to verify it first.
- If my account is suspended, deactivated, or banned, I cannot log in.

---

**US-AUTH-03 — View my own profile**

> As a logged-in user,
> I want to see my profile information,
> so that I can verify my details and see which schools I belong to.

Acceptance criteria:
- I can fetch my profile without providing my ID.
- The response includes my name, email, account status, platform admin flag, and my memberships (school ID, role, school-admin flag, membership status).
- Note: memberships are returned without the school's name or slug; the client has to look those up separately.

---

**US-AUTH-06 — Request a password reset link**

> As a user who has forgotten their password,
> I want to request a reset link sent to my registered email address,
> so that I can regain access to my account without contacting support.

Acceptance criteria:
- I submit my email address.
- If the email is registered, a reset link is sent.
- The response is the same whether or not the email is registered.
- The reset link expires after 1 hour.

---

**US-AUTH-07 — Reset password using a link**

> As a user who requested a password reset,
> I want to set a new password using the link I received,
> so that I can log in again.

Acceptance criteria:
- The reset page can check the link is still valid before I type a new password.
- I can submit a new password (minimum 6 characters).
- The link works only once; it cannot be reused after the reset.
- I can log in immediately with the new password.

---

**US-AUTH-08 — Verify email address after registration**

> As a newly registered user,
> I want to verify my email address,
> so that the platform can confirm I own the address I signed up with.

Acceptance criteria:
- After registration, a verification email is sent; the link is valid for 24 hours and works once.
- Following the link marks my account as verified and active, and logs me in.
- Unverified accounts cannot log in to the platform at all.
- I can ask for the verification email to be re-sent; the response does not reveal whether the email is registered.

---

## Users

---

**US-USER-01 — Create a platform user (admin action)**

> As a Super Admin,
> I want to create platform accounts for other users,
> so that I can onboard operators or school owners without them self-registering.

Acceptance criteria:
- I can specify name, email, and password, and optionally an account status and the platform admin flag.
- The new account is active by default and does not need email verification.
- The password is stored hashed, never in plain text.
- Duplicate emails are rejected.

---

**US-USER-02 — List all platform users**

> As a Super Admin,
> I want to see a list of all registered platform users,
> so that I can audit who has access to the system.

Acceptance criteria:
- I can retrieve all users in one request.
- I can narrow the list by exact ID, name, or email (see US-USER-09 for richer search).
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
> I want to update my name,
> so that my profile stays accurate.

Acceptance criteria:
- I can change my own name.
- I cannot change my own account status or platform admin flag; a request that includes them is rejected.
- I cannot update anyone else's profile.

---

**US-USER-05 — Promote or suspend a user (admin action)**

> As a Super Admin,
> I want to change a user's platform admin flag or account status,
> so that I can manage who has elevated access or revoke access without deleting the account.

Acceptance criteria:
- I can grant or remove the platform admin flag on any user.
- I can set the account status to suspended, deactivated, or banned, which blocks platform login and login to every school.
- Regular users cannot perform these actions on anyone, including themselves.
- Gap: access tokens already issued stay valid until they expire (default 1 day); see US-AUTH-04.

---

**US-USER-06 — Delete a platform user**

> As a Super Admin,
> I want to permanently delete a user account,
> so that I can remove users who should no longer exist in the system.

Acceptance criteria:
- The user account is permanently removed (not soft-deleted).
- The user's memberships and school role assignments are removed automatically.
- Only a Super Admin can perform this action.
- Gap: if the user was a school's Owner, the school is left without an Owner; nothing warns about this or requires a transfer first.

---

**US-USER-07 — Change my own password**

> As a logged-in user,
> I want to change my password by providing my current password and a new one,
> so that I can update my credentials without admin involvement.

Acceptance criteria:
- I provide my current password and a new password (minimum 6 characters).
- If the current password is wrong, the change is rejected.
- The new password is stored hashed; the old password no longer works.
- Because accounts are global, the new password applies to every school I belong to.

---

## Schools (Organizations)

---

**US-ORG-01 — Create a new school**

> As a logged-in user,
> I want to create a new school on the platform,
> so that I can set up a workspace for my institution.

Acceptance criteria:
- I provide a school name and a unique slug (lowercase letters, digits, and underscores; used as the school's subdomain), and optionally a custom domain.
- The school, its standard roles (e.g. admin, staff), and its Owner are set up together; if any step fails, nothing is created.
- When a regular user creates a school, they become its Owner and receive an activation email for it.
- A Super Admin can name another existing user as Owner, or create the school with no Owner and assign one later (US-ORG-08).
- A duplicate slug is rejected.
- Note: a new Owner's school membership is pending until they follow the activation link (valid 7 days), which also sets their password. Until then they cannot sign in to the school, even if they created it themselves.

---

**US-ORG-02 — View my schools**

> As a logged-in user,
> I want to see the list of schools I belong to,
> so that I know which workspaces I can access.

Acceptance criteria:
- I only see schools where I have a membership (owner, admin, or member).
- A Super Admin sees all schools on the platform.

---

**US-ORG-03 — View a school's details**

> As a member of a school or a Super Admin,
> I want to view a school's details by its ID,
> so that I can inspect its name, slug, domain, and status.

Acceptance criteria:
- A Super Admin can view any school.
- A regular user can only view schools they are a member of.
- Requesting a school the user has no membership in is rejected; an unknown school ID returns not found.

---

**US-ORG-04 — Update a school**

> As the Owner of a school or a Super Admin,
> I want to update the school's name, domain, or status,
> so that I can keep the school's information current.

Acceptance criteria:
- Only the school's Owner or a Super Admin can make changes.
- The slug cannot be changed after creation.
- The status can be set to pending, active, inactive, suspended, or archived (any value, no transition rules).
- Admins and Members cannot edit school settings.
- Gap: the update currently requires the name to be sent every time; a status-only or domain-only update is rejected.

---

**US-ORG-05 — Delete a school**

> As a Super Admin,
> I want to permanently delete a school,
> so that I can remove institutions that are no longer using the platform.

Acceptance criteria:
- Only a Super Admin can delete a school.
- All of the school's data (students, staff, roles, memberships, school-issued tokens, and everything else tied to it) is permanently removed in one step.
- User accounts are kept, since they are shared across schools.
- This action is irreversible; there is no soft delete or confirmation step.

---

**US-ORG-11 — Re-send the Owner activation link**

> As a School Owner or a Super Admin,
> I want to issue a fresh activation link for the school's Owner,
> so that an Owner whose link expired or was lost can still activate.

Acceptance criteria:
- A new single-use link is created and emailed to the current Owner; it is also returned to the caller.
- Only the school's Owner or a Super Admin can do this.
- If the school has no Owner, a not-found error is returned.

---

**US-ORG-12 — Find a school before signing in**

> As a visitor on a school's custom domain or subdomain,
> I want the app to recognise which school I am visiting,
> so that I land on the right sign-in page.

Acceptance criteria:
- A school can be looked up without signing in, by custom domain or by slug.
- Only the slug, name, and status are returned.
- Schools that are not active are reported as not found.

---

## Memberships

---

**US-MEMBER-01 — Add a user to a school (admin action)**

> As a Super Admin,
> I want to add an existing platform user to a school with a specific role,
> so that they can access that school's workspace.

Acceptance criteria:
- I specify the user ID, the school ID, and a role (`owner`, `admin`, or `member`; default `member`).
- A user cannot be added to the same school twice; a duplicate is rejected.
- The school and the user must exist; unknown IDs are rejected.
- Adding someone as `owner` is only possible when the school has no Owner; it sends them an activation link. Otherwise use ownership transfer (US-ORG-08).
- `admin` and `owner` memberships make the user a school admin; `member` does not.

---

**US-MEMBER-02 — View members of a school**

> As a Super Admin or the school's Owner,
> I want to see all members of a specific school,
> so that I know who has access to it.

Acceptance criteria:
- I provide the school's ID and receive its memberships with each user ID, role, school-admin flag, and status.
- Results are ordered by when each membership was created.
- Other users are rejected.
- Note: user names and emails are not included in the response.

---

**US-MEMBER-03 — View all schools a user belongs to**

> As a Super Admin, or a user looking at their own access,
> I want to look up all schools a given user is a member of,
> so that I can understand their access across the platform.

Acceptance criteria:
- I provide a user ID (or use "my memberships") and receive the membership list with school IDs, roles, and status.
- A regular user can only look up themselves.
- Results are ordered by when each membership was created.
- Note: school names and slugs are not included in the response.

---

**US-MEMBER-04 — Look up a specific membership**

> As a Super Admin, the school's Owner, or the member themselves,
> I want to retrieve a membership record by its ID,
> so that I can see the exact role a user holds in a school.

Acceptance criteria:
- I provide a membership ID and receive the full membership record.
- Anyone else is rejected.
- A not-found error is returned if the ID does not exist.

---

**US-MEMBER-05 — Change a member's role**

> As a Super Admin or the school's Owner,
> I want to change the role of an existing membership,
> so that I can promote a member to admin or demote an admin to member.

Acceptance criteria:
- I provide the membership ID and the new role (`owner`, `admin`, or `member`).
- An Owner cannot change the Owner membership or assign the `owner` role; only a Super Admin can.
- Assigning `owner` while the school already has a different Owner is rejected (use ownership transfer).
- Gap: demoting someone to `member` removes the school-admin flag but does not remove school roles they already hold (e.g. the full-access `admin` role given to Owners).

---

**US-MEMBER-06 — Remove a user from a school**

> As a Super Admin or the school's Owner,
> I want to remove a user's membership from a school,
> so that they can no longer access that school's workspace.

Acceptance criteria:
- The membership and the user's role assignments in that school are permanently deleted.
- The user's platform account is not affected.
- An Owner cannot remove the Owner membership; only a Super Admin can.

---

**US-MEMBER-07 — School Owner adds a user to their school**

> As the Owner of a school,
> I want to add an existing platform user to my school,
> so that I can manage my school's team without requiring Super Admin involvement.

Acceptance criteria:
- An Owner can add users with roles of `admin` or `member` (not `owner`).
- The user must already have a platform account.
- Duplicate memberships are rejected.
- Note: the user is added directly and is active immediately; there is no invitation the user has to accept.

---

**US-MEMBER-11 — Keep one Owner per school**

> As a platform rule,
> each school should have at most one Owner,
> so that ownership is always unambiguous.

Acceptance criteria:
- Creating an `owner` membership, or changing a role to `owner`, is rejected when the school already has a different Owner.
- Ownership transfer (US-ORG-08) swaps Owners in one step, demoting the previous Owner automatically.
- Note: this is enforced by the application, not by a database constraint.

---

---

## Suggested Stories — Missing or Partly Implemented

The stories below describe functionality that is absent or only partly present in the current codebase. Each one is marked with a status tag so the team can prioritise them.

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
- Note: JWTs are stateless and are not checked against the database on each request; a token denylist or short-lived refresh-token mechanism is needed. The same mechanism would make suspensions (US-USER-05) take effect immediately.

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

### Users

---

**US-USER-07b — Super Admin sets another user's password** `[NOT IMPLEMENTED]`

> As a Super Admin,
> I want to set a new password for another user without knowing their current one,
> so that I can help a user who is locked out.

Acceptance criteria:
- I can set a new password (minimum 6 characters) for any user.
- Regular users cannot do this for anyone else.
- Note: today a user can only change their own password (with the current one) or use the reset-by-email flow.

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

**US-USER-09 — Search and filter platform users** `[PARTIAL]`

> As a Super Admin,
> I want to search users by name, email, status, or admin flag,
> so that I can find specific accounts quickly without scrolling through the full list.

Acceptance criteria:
- I can filter by partial name or email (case-insensitive).
- I can filter by account status and/or the platform admin flag.
- Results are paginated.
- Note: the list endpoint only supports exact matches on ID, name, or email today.

---

**US-USER-10 — Paginate the user list** `[NOT IMPLEMENTED]`

> As a Super Admin,
> I want the user list to be paginated,
> so that the API does not return thousands of records in one response as the platform grows.

Acceptance criteria:
- I can specify a page number and page size.
- The response includes total count, current page, and the data slice.

---

**US-USER-11 — Reactivate a suspended account** `[PARTIAL]`

> As a Super Admin,
> I want to reactivate a previously suspended or deactivated user account,
> so that a user who was temporarily suspended can regain access.

Acceptance criteria:
- Setting the account status back to active re-enables their login.
- This is a distinct action from deletion and should be confirmable.
- Note: the user update endpoint (`PATCH /platform/users/:id` with `status: "active"`) allows this today, but there is no explicit "reactivate" action or confirmation flow.

---

### Schools (Organizations)

---

**US-ORG-06 — Look up a school by its slug** `[PARTIAL]`

> As an authenticated user or system,
> I want to retrieve a school's details using its slug,
> so that I can resolve a URL-friendly identifier to a full school record.

Acceptance criteria:
- I provide a slug and receive the matching school record.
- A not-found error is returned if no school has that slug.
- Note: the public endpoint `GET /public/organizations/by-slug` exists, but it returns only slug, name, and status, and only for active schools (US-ORG-12). There is no authenticated lookup that returns the full record.

---

**US-ORG-07 — Filter schools by status** `[NOT IMPLEMENTED]`

> As a Super Admin,
> I want to filter the school list by status (e.g., active, suspended, archived),
> so that I can quickly audit schools in a particular state.

Acceptance criteria:
- I can pass an optional status filter to the list endpoint.
- Only schools matching the status are returned.
- Without a filter, all schools are returned (existing behaviour).

---

**US-ORG-08 — Transfer school ownership to another user** `[PARTIAL]`

> As the Owner of a school,
> I want to transfer ownership to another user,
> so that someone else can take over administration of the school.

Acceptance criteria:
- I can designate another user as the new Owner; they receive an activation link.
- The previous Owner becomes an Admin, becomes a Member, or is removed from the school (Admin by default).
- There is only one Owner per school at any time.
- A Super Admin can also perform this transfer.
- Note: the transfer endpoint (`POST /organizations/:id/transfer-ownership`) is implemented, but only a Super Admin can call it. Owners have no self-service transfer.

---

**US-ORG-09 — Suspend or archive a school** `[PARTIAL]`

> As a Super Admin,
> I want to suspend or archive a school,
> so that I can disable access without permanently destroying the data.

Acceptance criteria:
- Setting the status to `suspended` blocks all access to that school's workspace, including sign-in.
- Setting the status to `archived` makes the school read-only for historical records.
- The school's data is preserved in both cases.
- Note: any status other than `active` already blocks every school-workspace request and hides the school from the public lookup, with data preserved. There is no read-only mode for `archived`; it is blocked the same way as `suspended`.

---

**US-ORG-10 — Paginate the school list** `[NOT IMPLEMENTED]`

> As a Super Admin,
> I want the school list to be paginated,
> so that large deployments with many schools remain performant.

Acceptance criteria:
- I can specify a page number and page size.
- The response includes total count, current page, and the data slice.

---

### Memberships

---

**US-MEMBER-08 — School Admin manages memberships within their school** `[PARTIAL]`

> As an Admin of a school,
> I want to add and remove members from my school,
> so that day-to-day team management does not require escalating to the platform operator.

Acceptance criteria:
- An Admin can add users as `member` (not `admin` or `owner`).
- An Admin can remove `member`-level memberships.
- An Admin cannot change or remove another Admin's membership or the Owner's membership.
- Note: the platform membership endpoints only allow the Owner or a Super Admin. Inside the school workspace, staff with the `users:*` permissions (and school admins) can add, update, and remove members through the school's user management (`/users`), but that path has no protection for the Owner or other Admins.

---

**US-MEMBER-09 — Leave a school** `[NOT IMPLEMENTED]`

> As a member or admin of a school,
> I want to remove myself from the school,
> so that I can voluntarily give up access without waiting for an admin action.

Acceptance criteria:
- I can delete my own membership.
- An Owner cannot leave a school they own; they must transfer ownership first.
- My platform account is not affected.
- Note: today only the school's Owner or a Super Admin can remove a membership.

---

**US-MEMBER-10 — View my membership within a specific school** `[PARTIAL]`

> As a logged-in user,
> I want to see my own membership record for a given school,
> so that I can confirm my current role without fetching the full member list.

Acceptance criteria:
- I provide a school ID and receive my membership record (role, status, joined date).
- If I have no membership in that school, a not-found response is returned.
- Note: `GET /memberships?orgId=<id>` already returns only the caller's own membership for a regular user, but as a list (empty when there is none) rather than a single record or a not-found.

---

## Story Map Summary

```
Platform Admin
│
├── Authentication
│   ├── US-AUTH-01  Register account (email verification required)
│   ├── US-AUTH-02  Log in
│   ├── US-AUTH-03  View own profile
│   ├── US-AUTH-04  Log out / invalidate token          [NOT IMPLEMENTED]
│   ├── US-AUTH-05  Refresh access token                [NOT IMPLEMENTED]
│   ├── US-AUTH-06  Request password reset link
│   ├── US-AUTH-07  Reset password via link
│   └── US-AUTH-08  Verify email after registration
│
├── Users
│   ├── US-USER-01  Create user                         [Super Admin]
│   ├── US-USER-02  List all users                      [Super Admin]
│   ├── US-USER-03  View user profile                   [Super Admin / Self]
│   ├── US-USER-04  Update own profile                  [Self]
│   ├── US-USER-05  Change admin flag / status          [Super Admin]
│   ├── US-USER-06  Delete user                         [Super Admin]
│   ├── US-USER-07  Change own password                 [Self]
│   ├── US-USER-07b Set another user's password         [NOT IMPLEMENTED]
│   ├── US-USER-08  Change email address                [NOT IMPLEMENTED]
│   ├── US-USER-09  Search and filter users             [PARTIAL]
│   ├── US-USER-10  Paginate user list                  [NOT IMPLEMENTED]
│   └── US-USER-11  Reactivate suspended account        [PARTIAL]
│
├── Schools (Organizations)
│   ├── US-ORG-01  Create school                        [Any authenticated user]
│   ├── US-ORG-02  List my schools                      [Any authenticated user]
│   ├── US-ORG-03  View school details                  [Member / Super Admin]
│   ├── US-ORG-04  Update school                        [Owner / Super Admin]
│   ├── US-ORG-05  Delete school                        [Super Admin]
│   ├── US-ORG-06  Look up school by slug               [PARTIAL]
│   ├── US-ORG-07  Filter schools by status             [NOT IMPLEMENTED]
│   ├── US-ORG-08  Transfer school ownership            [PARTIAL: Super Admin only]
│   ├── US-ORG-09  Suspend or archive a school          [PARTIAL]
│   ├── US-ORG-10  Paginate school list                 [NOT IMPLEMENTED]
│   ├── US-ORG-11  Re-send Owner activation link        [Owner / Super Admin]
│   └── US-ORG-12  Find a school before sign-in         [Public]
│
└── Memberships
    ├── US-MEMBER-01  Add user to school                 [Super Admin]
    ├── US-MEMBER-02  List school members                [Owner / Super Admin]
    ├── US-MEMBER-03  List user's schools                [Self / Super Admin]
    ├── US-MEMBER-04  View membership                    [Self / Owner / Super Admin]
    ├── US-MEMBER-05  Change member role                 [Owner / Super Admin]
    ├── US-MEMBER-06  Remove from school                 [Owner / Super Admin]
    ├── US-MEMBER-07  Owner adds user to school          [Owner]
    ├── US-MEMBER-08  Admin manages school memberships   [PARTIAL]
    ├── US-MEMBER-09  Leave a school                     [NOT IMPLEMENTED]
    ├── US-MEMBER-10  View own membership in a school    [PARTIAL]
    └── US-MEMBER-11  One Owner per school               [Enforced in app]
```
