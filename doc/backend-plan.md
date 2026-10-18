# School ERP: Backend implementation plan (Phase 1a)

> **Status:** Draft v0.2 · **Owner:** Biprodas Roy · **Last updated:** 2026-10-18
> This doc covers build order and acceptance criteria for `backend/` (NestJS 11, TypeORM 1.x, PostgreSQL) in Phase 1a.
> It does not specify the product. The specs are in [`prd.md`](./prd.md) (v1.3) and [`domains-and-routing.md`](./domains-and-routing.md); code conventions are in [`../CLAUDE.md`](../CLAUDE.md).

---

## 0. How to use this plan

- **Milestones are in dependency order** (section 3). M0–M8 together are Phase 1a of PRD section 12.
- Each milestone has the same parts: **Scope · Tasks (tables, endpoints, rules) · Done when**.
- **Tick the checkboxes as work lands**, so the doc also works as a tracker. Tick a parent item only when all its children are ticked.
- A milestone is **done** only when every "Done when" box is ticked and each module meets the [Definition of done](#13-definition-of-done-every-module).
- This is a starting plan, not a fixed spec. When implementation shows a better way, change the code and update this doc to match.
- Items marked **(1b)** are listed only so Phase 1a leaves room for them; they are tracked in section 14.

**Current state:** no milestone started. Section 1 lists what already exists and can be reused.

---

## 1. Where the backend stands today

**Solid and reusable**

- Tenancy: `OrgScopedEntity`, `BaseTenantRepository` (`findPage`, `deleteById` with soft delete, `findByIdOrFail`), `scopeRepository` pinning, `ds.runInTransaction`, RLS (`rls.ts`) and the restricted app role, `TenantMiddleware` with header → subdomain → custom-domain resolution, `TenantConnectionService.getScopedConnection(orgId)`.
- Custom domains, DNS checks, the TLS ask endpoint, and cross-host handoff codes (all done, with e2e tests).
- Response envelope, global exception filter (unique/FK violations → 409), pagination DTOs, pino logging with `reqId`/`orgId`/`userId`, `TenantThrottlerGuard`, Swagger, the Joi env schema.
- Mail: `shared/mail` (`@nestjs-modules/mailer` + Handlebars), templates for activation, verification, reset and welcome.
- Auth: platform and tenant JWT realms, email verification, password reset, owner activation, `OwnerProvisioningService`, RBAC with code-defined permissions and per-org roles, the `isAdmin` bypass.
- Academic and people CRUD: academic years (one current), permanent classes, subjects, subject groups, per-year class curriculum (`class_subjects`, `class_subject_groups`), class/subject teachers per year, enrollments with student subjects, students with addresses, emergency contacts, documents, notes and a medical record, guardians with links, employees with departments and designations.
- Tests: 43 unit specs, 8 e2e specs that run against a real Postgres with RLS on.

**Missing or wrong for Phase 1a**

| Area | Gap |
| ---- | --- |
| Identity | `users.email` is required, there is no `phone`; no lockout after failed logins; one long-lived JWT (1 day), no refresh tokens or session list; no general invite flow (tenant `POST /users` sets a password directly) |
| Platform | `POST /organizations` is open to any platform user; `organizations` has no plan, trial, type, profile or onboarding columns; no plans/entitlements; no self-serve "sign up a school" flow; slug regex allows `_` and there is no reserved list; no slug history |
| RBAC | No scope rules (own sections/subjects); system roles don't match PRD 6.3 (`staff`, `parent`, `stakeholder` exist; Principal, Class Teacher, Receptionist, Guardian don't) |
| Academic | No shifts, terms, rooms; sections are a global name list joined to classes by `class_sections` (no session, no shift); teacher assignments are not effective-dated; no rollover |
| SIS | No generated student ID; status enum lacks suspended/left/dropped_out; no Bangla name fields; promotion is a single audit row with no enrollment change, no preview, no rollback; no file upload; no Excel import; guardian relation enum has `BROTHER = 'BROTHER'` |
| Missing modules | Settings, audit log, numbering, file storage, queues, PDFs, attendance, holidays, exams/grading, fees, notices/notifications, portal, dashboards/reports |
| Cleanup | `stakeholders` module (not in the PRD); `console.log` hooks in `User`; `class-subject-groups` and `subject-teachers` have no PATCH |

---

## 2. Conventions used by every module

These follow `CLAUDE.md`; the rows marked **new** are introduced by this plan.

| Topic | Convention |
| ----- | ---------- |
| **Tenanted tables** | Extend `OrgScopedEntity`. Per-org unique keys include `orgId`; soft-deletable keys are partial (`WHERE deleted_at IS NULL`). Each migration that creates one enables RLS, creates `org_isolation` and grants the app role, copying `1792321369675-OrganizationDomains.ts`. |
| **Platform tables** | Plans, signup requests, slug history, geo data and platform audit are plain entities read through the root connection with `@InjectRepository`. Their routes go in the `TenantMiddleware` exclude list. |
| **Permissions** | Every new endpoint gets catalog keys and `@RequirePermissions`. Setup resources keep `resource:read\|create\|update\|delete`. Workflow actions get task keys named in the PRD: `attendance:take`, `attendance:edit_locked`, `results:enter`, `results:verify`, `results:approve`, `results:publish`, `results:reopen`, `fees:collect`, `fees:cancel_receipt`, `fees:approve_waiver`, … System-role seed updates ship in the same change. |
| **Scope** (new) | Endpoints that read or write section or subject data call `AccessScope` (M0) and filter by it. Query builders add the `orgId` filter by hand (they aren't rewritten). |
| **Audit** (new) | Auth events, permission/role changes, financial records, mark changes, attendance corrections and data exports call `AuditService.record(...)` inside the same transaction as the change. |
| **Money** (new) | `bigint` minor units (poisha) in the DB and the API, with a `currency` from org settings. No floats anywhere in fee math. |
| **Dates** (new) | Business dates (attendance day, due date, billing period) are `date` columns computed in the org's time zone (`Asia/Dhaka` default); instants are `timestamptz`. |
| **Bulk work** (new) | Imports, invoice runs, PDF batches, exports and notification fan-out run on a BullMQ queue, tracked by a `jobs` row that the client polls. Request handlers only enqueue. |
| **Idempotency** (new) | Retryable writes (attendance submit, payment record, imports, bulk actions) accept an `Idempotency-Key` header, stored per org with the response for 24 hours. |
| **Error codes** (new) | `GlobalExceptionFilter` adds a stable `code` (e.g. `ATTENDANCE_LOCKED`, `SLUG_TAKEN`) next to `message`, so the frontend can localize errors into Bangla. |
| **Module boundaries** | Modules call each other's exported services, never repositories. Composite views (student 360, dashboards, portal) live in their own modules that depend on feature services. |
| **Tests** | Pure logic (grading, fees, numbering, scope) gets unit suites. Each milestone adds e2e specs for its PRD acceptance criteria plus cross-tenant and IDOR cases (PRD 11.4). |

---

## 3. Milestone overview

```mermaid
flowchart LR
  M0[M0 Foundation] --> M1[M1 Platform & onboarding]
  M0 --> M2[M2 Academic & staff]
  M2 --> M3[M3 SIS]
  M3 --> M4[M4 Attendance]
  M3 --> M5[M5 Exams & results]
  M3 --> M6[M6 Fees]
  M4 --> M7[M7 Notices, portal, dashboards]
  M5 --> M7
  M6 --> M7
  M7 --> M8[M8 Pilot hardening]
  M1 --> M8
```

| # | Milestone | Estimate (PRD 12.2) | Depends on | Status |
| - | --------- | ------------------- | ---------- | ------ |
| M0 | Foundation hardening | 1–2 weeks | — | ☐ |
| M1 | Platform admin and onboarding | ~1 week (overlaps M0) | M0 | ☐ |
| M2 | Academic structure and staff directory | 1.5–2 weeks | M0 | ☐ |
| M3 | Student information system | 1.5–2 weeks | M2 | ☐ |
| M4 | Attendance and student leave | 2 weeks | M2, M3 | ☐ |
| M5 | Exams and results | 3 weeks | M2, M3 | ☐ |
| M6 | Fees | 3 weeks | M3 | ☐ |
| M7 | Notices, notifications, portal, dashboards | 2–3 weeks | M4, M5, M6 | ☐ |
| M8 | Settings completion and pilot hardening | 2 weeks | all | ☐ |

M4, M5 and M6 don't depend on one another, so they can be reordered (fees first if a pilot school needs billing early). The total is roughly 16–19 weeks for one developer.

---

## 4. M0: Foundation hardening

**Scope:** clean up, add the infrastructure modules every later milestone needs, and bring identity, RBAC, audit and settings up to the PRD.

### 4.1 Cleanup

- [ ] Drop `stakeholders`:
  - [ ] Remove the module, its catalog keys, the `stakeholder` system role in the seed, and the import in `app.module.ts`.
  - [ ] Migration `DropStakeholders`: delete `user_roles` rows for that role, delete the role rows, drop the table, revoke the grant.
  - [ ] Update `CLAUDE.md`, `backend/README.md`, `doc/db-schema.md`, `doc/example-menu-frontend.md`.
- [ ] Fix `StudentGuardianRelation.BROTHER` to `'brother'`, with a data migration.
- [ ] Remove the `console.log` entity hooks in `User`.
- [ ] Restrict `POST /organizations` to `PlatformAdminGuard` (self-serve creation moves to the signup flow, M1).
- [ ] Leave `timetable` dormant: no new work, out of seeded roles and the frontend menu (its `section_id` FK moves in M2).

### 4.2 Infrastructure modules

- [ ] **Dependencies:** `@nestjs/bullmq`, `bullmq`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `puppeteer`, `exceljs`, `file-type`, `nestjs-cls` (see open point 4).
- [ ] **Local stack:** MinIO in `docker-compose.yml` (API and console ports, a default bucket), `.env.docker.example` updated.
- [ ] **Env vars** in `env.validation.ts` and `backend/.env.example`: `REDIS_URL`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_FORCE_PATH_STYLE`, `PDF_CONCURRENCY`, `FIELD_ENCRYPTION_KEY`, `JWT_REFRESH_TTL`, `UPLOAD_MAX_BYTES`.
- [ ] **`QueueModule`** (`src/shared/queue/`):
  - [ ] Queues `mail`, `notifications`, `pdf`, `imports`, `billing`, `exports` on Redis.
  - [ ] Job payloads always carry `orgId` and `actorUserId`.
  - [ ] Inline or no-op under `NODE_ENV=test` unless a spec opts in.
- [ ] **Tenant context for workers** (`src/tenancy/tenant-job.runner.ts`):
  - [ ] `runAsTenant(orgId, fn)` builds a `TenantDataSourceProxy` from `TenantConnectionService.getScopedConnection(orgId)`, registers it under a fresh `ContextIdFactory` context, and resolves request-scoped services via `ModuleRef.resolve`.
  - [ ] Releases the QueryRunner afterwards; workers never read tenant data through the root connection, so RLS still applies.
  - [ ] Spec: a job for org A can't see org B's rows.
- [ ] **`jobs` module** (`src/modules/jobs/`): org-scoped `jobs (type, status queued|running|succeeded|failed, progress, result jsonb, error, created_by, file_id)`; `GET /jobs/:id` for polling.
- [ ] **`StorageModule`** (`src/shared/storage/`): `put`, `getSignedUrl(key, ttl = 5 min)`, `delete`; keys are `orgs/<orgId>/<kind>/<uuid>`.
- [ ] **`files` module** (`src/modules/files/`):
  - [ ] Org-scoped `files (key, mime, size, sha256, purpose, uploaded_by)`.
  - [ ] Multipart upload through the API (multer memory storage), per-purpose allow-list of types, magic-byte sniffing, per-file size limit, plan storage quota.
  - [ ] Signed download URLs only after the caller passes the owning resource's permission check.
  - [ ] Virus scanning **(1b)**.
- [ ] **`PdfModule`** (`src/shared/pdf/`):
  - [ ] Puppeteer browser pool (concurrency from env), Handlebars templates in `src/shared/pdf/templates/`.
  - [ ] Bundled Bangla fonts (Noto Sans Bengali / Noto Serif Bengali); a smoke test renders Bangla conjuncts.
  - [ ] `render(template, data, { paper: 'A4' | 'Legal' | '80mm' })` returns a Buffer; called only from the `pdf` queue.
  - [ ] Production image includes Chromium.
- [ ] **`SpreadsheetModule`** (`src/shared/spreadsheet/`): build a template workbook from a column spec, parse rows into typed records, write exports.
- [ ] **`NumberingService`** (`src/modules/numbering/`):
  - [ ] Org-scoped `numbering_sequences (org_id, key, scope, next_value)`.
  - [ ] `next(key, scope)` uses `SELECT … FOR UPDATE` in the caller's transaction, so a rollback never burns a number (gap-free receipts).
  - [ ] `format(pattern, ctx)` supports `{YYYY}`, `{YY}`, `{CLASS}`, `{SEQ:n}`.
  - [ ] Unit suite, plus a concurrency e2e (parallel `next()` calls give distinct, gap-free numbers).
- [ ] **Field encryption** (`src/shared/crypto/`): `EncryptedColumnTransformer` (AES-256-GCM, key id prefix for rotation) for NID, health fields and bank accounts. Encrypted columns are never searched.
- [ ] **Idempotency-Key** interceptor + org-scoped `idempotency_keys` table (24-hour retention).
- [ ] **Error `code`** added to `GlobalExceptionFilter` and the error envelope.

### 4.3 Identity (PRD 5.1, 6.3)

- [ ] **Email or phone:**
  - [ ] Migration: `users.email` nullable, add `phone` (E.164), partial unique indexes on `lower(email)` and `phone`, `CHECK (email IS NOT NULL OR phone IS NOT NULL)`, add `phone_verified_at` (set in 1b) and `must_change_password`.
  - [ ] Phone normalization for Bangladesh (`01…`, `+8801…`) with unit tests.
  - [ ] Login DTOs take `identifier` (email or phone) + password, in both realms.
  - [ ] JWT payload drops `email`; `AuthUser` and both strategies follow.
- [ ] **Lockout:** `users.failed_login_count`, `locked_until`; 5 failures → 15-minute lock; success resets; both written to the audit log; admins can list lock events for their school's members.
- [ ] **Sessions and refresh tokens:**
  - [ ] Platform table `user_sessions (id, user_id, org_id nullable, refresh_hash, family_id, user_agent, ip, created_at, last_used_at, expires_at, revoked_at)`.
  - [ ] Access JWT lasts 15 minutes and carries `sid`; refresh tokens rotate, and reusing an old one revokes the whole family.
  - [ ] Endpoints in both realms: `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/sessions`, `DELETE /auth/sessions/:id`, `POST /auth/logout-all`.
  - [ ] `JwtStrategy` rejects a revoked `sid` (Redis cache, 60 s).
  - [ ] Idle timeout from org settings, enforced on refresh using `last_used_at`.
  - [ ] A session issued for one org can't be refreshed for another.
- [ ] **Invites:**
  - [ ] `POST /users/invite { email? | phone?, name, roleIds, employeeId? }`: create or link the account, PENDING membership, roles, activation token.
  - [ ] With an email, mail the link. Without one, return a one-time temporary password for a printed slip (`must_change_password = true`).
  - [ ] Existing `POST /users` stays for admins but sets `must_change_password`.
  - [ ] `OwnerProvisioningService` reuses the same activation path.
- [ ] **Bulk credential slips:** `POST /users/credential-slips { sectionId, audience: guardians|students }` job: create the missing accounts, set temporary passwords, render a PDF of slips per section.
- [ ] Frontend follow-up noted: NextAuth stores the refresh token and refreshes before expiry.

### 4.4 RBAC alignment and scope rules (PRD 4.4, 6.3)

- [ ] **System roles** per PRD 6.3: `admin`, `principal`, `accountant`, `teacher`, `class_teacher`, `receptionist`, `librarian`, `student`, `guardian`, with permission sets from the 4.4 matrix (updated as milestones add keys).
- [ ] Migration `AlignSystemRoles` for existing orgs: rename `parent` → `guardian`, move `staff` holders to `principal`, insert the missing roles, rewrite permissions of `is_system` roles; custom roles untouched.
- [ ] `POST /roles/:id/clone`.
- [ ] **Scope:**
  - [ ] `roles.scope` (`school` | `assigned`, default `school`); seeded `teacher` and `class_teacher` use `assigned`.
  - [ ] `PermissionResolverService` returns, per permission key, the widest scope among the user's roles that grant it.
  - [ ] Request-scoped `AccessScope`: `can(key)`, `sectionIds(key)` (`null` = unrestricted, else sections with an active class- or subject-teacher assignment in the current session), `subjectAssignments(key)` (`(sectionId, classSubjectId)` pairs). Data from an exported `TeachingService` method, cached per request.
  - [ ] Unit suite for permission evaluation with scopes (PRD 11.1).
- [ ] Guardian and student roles hold only `portal:*` keys, so their tokens are refused on staff endpoints (portal endpoints in M7).

### 4.5 Audit log (PRD 6.3, 8.1)

- [ ] Org-scoped `audit_logs (actor_user_id, actor_type user|platform|system, action, entity_type, entity_id, before jsonb, after jsonb, ip, user_agent, request_id, impersonator_id, created_at)`.
- [ ] `platform_audit_logs` with the same shape, no RLS, for platform actions and pre-tenant auth events.
- [ ] Immutable: the migration grants the app role only `SELECT, INSERT` on `audit_logs`.
- [ ] `AuditService.record()` takes actor, IP and request id from the request context.
- [ ] Auth events (login, failed login, lock, password change, session revoke) and role/permission changes recorded.
- [ ] `GET /audit-logs` with filters (`audit:read`).

### 4.6 Settings (PRD 6.24)

- [ ] Extend `organizations`: `type` (school/college/madrasa/coaching/english_medium), `plan_id`, `trial_ends_at`, `onboarding_completed_at`, `listed_in_directory`, `eiin`, `logo_file_id`, `parent_org_id` (nullable, unused until Phase 3). Add `trial` and `past_due` to `OrganizationStatus`.
- [ ] Org-scoped `org_settings` (one row per org) with typed jsonb sections, each validated by a DTO:
  - [ ] `profile`: address, contact, principal signature file, letterhead options.
  - [ ] `locale`: language, date format, numerals (bn/en), currency, time zone, week start, weekend days.
  - [ ] `numbering`: patterns for student ID, roll, receipt, invoice, certificate.
  - [ ] `portal`: classes whose students get accounts (default `level >= 6`).
  - [ ] `results`: `verifyStep` on/off.
  - [ ] `attendance`: mode (day/period), lock after N days, cutoff time.
  - [ ] `fees`: billing day, grace days, block results on dues.
  - [ ] `notifications`: channel preferences.
- [ ] `GET /settings`, `PATCH /settings/:section` (`settings:read`, `settings:update`), audited.
- [ ] `SettingsService.get(orgId)` cached per request and in memory, invalidated on write.

### 4.7 CI

- [ ] GitHub Actions: lint, `npm test`, `npm run test:e2e` with Postgres 17 and Redis service containers, `npm run build`; required on every PR.
- [ ] Tenant-isolation, grading and fee suites named so the PRD 11.5 release criteria can point at them.

### Done when

- [ ] Stakeholders are gone and the app boots with no reference to them.
- [ ] Email-or-phone login, lockout, refresh/session revoke and invites work end to end (e2e).
- [ ] Scope rules are covered by the unit suite.
- [ ] Audit rows are written for auth and role changes, and the app role can't update or delete them.
- [ ] Queue, storage, PDF (with Bangla text) and numbering have passing smoke e2e tests.
- [ ] CI is green on a PR.

---

## 5. M1: Platform admin and onboarding

**Scope:** PRD 6.1 Phase 1a (super-admin only), 6.2, 7.1 and `domains-and-routing.md` sections 2–4.

### 5.1 Plans and entitlements (PRD 3.3, 6.1)

- [ ] Platform table `plans (code, name, price_per_student, min_fee, modules text[], limits jsonb {students, storage_mb, users, admins})`, seeded with Free/Basic/Standard/Premium.
- [ ] `EntitlementService` (exported, cached per org): `hasModule(org, key)`, `assertLimit(org, 'students', delta)`; the trial grants Standard.
- [ ] `@RequireModule('fees')` decorator + guard → 403 `MODULE_NOT_IN_PLAN`.
- [ ] Platform endpoints (`PlatformAdminGuard`), each writing `platform_audit_logs`:
  - [ ] `PATCH /organizations/:id/plan`
  - [ ] `POST /organizations/:id/trial/extend { days }`
  - [ ] `PATCH /organizations/:id/limits`
- [ ] School directory: `GET /organizations` gains filters (plan, status, type, district, created range) and columns (active student count via a cached counter, plan, trial end).

### 5.2 Slugs

- [ ] One reserved list in `backend/src/shared/slug/reserved-slugs.ts`, served at `GET /public/slugs/reserved` for `frontend/src/lib/tenant.ts`.
- [ ] Slug rule `^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$` in every DTO; a migration rewrites existing slugs containing `_`.
- [ ] `GET /public/slugs/check?slug=` returns availability plus up to three suggestions; rate-limited.
- [ ] `organization_slug_history (org_id, slug unique, expires_at)`.
- [ ] `PATCH /settings/slug` (school admin, once per 30 days) in one transaction with a history row.
- [ ] `TenantMiddleware` and `/public/organizations/resolve` return a redirect target for an old slug; history slugs can't be claimed until they expire.

### 5.3 Self-serve signup (PRD 6.2, 7.1)

- [ ] Platform table `signup_requests (school_name, type, slug, owner_name, email, phone, password_hash, token_hash, expires_at, completed_at)`; it never reserves the slug.
- [ ] `POST /public/signup`: validate, store, email the verification link; uniform response.
- [ ] `POST /public/signup/verify { token }`, in one transaction:
  - [ ] Re-check the slug.
  - [ ] Create or link the user (an existing verified account keeps its password).
  - [ ] Create the org through `OrganizationService.createOrganization` with `trial_ends_at = now + 30 days`.
  - [ ] Issue a handoff code; the client redirects to `https://<slug>.<root>/auth/handoff?code=…&next=/onboarding`.
- [ ] SMS OTP step on the same request record **(1b)**.

### 5.4 Onboarding and "Find your school"

- [ ] `GET /onboarding/checklist` computes each step from real data (profile, current session, classes + sections, curriculum, grading system, fee heads, staff invited, students imported) and returns a percentage.
- [ ] `POST /onboarding/complete` and `POST /onboarding/skip` set `onboarding_completed_at`; the tenant `me` response carries the flag for the frontend gate.
- [ ] Code-defined templates in `src/shared/templates/`, applied by idempotent "apply" endpoints:
  - [ ] NCTB classes and subjects (Class 1–10, groups for 9–10)
  - [ ] Cambridge
  - [ ] Alia madrasa
  - [ ] Grading templates (BD GPA 5.0 and the others in M5)
  - [ ] BD government holidays for the year
  - [ ] Default fee heads
- [ ] `POST /public/find-school { email }`: always 202; enqueues a mail listing every school with an ACTIVE membership, each linking to `https://<host>/login?identifier=…`; rate-limited per IP and per recipient. Phone input **(1b)**.
- [ ] Sample data: `POST /onboarding/sample-data` (job) fills a demo session; `DELETE` removes everything it created (`sample_batch_id`). Lowest priority.

### Done when

- [ ] A school signs up, verifies by email and lands signed in on its own host (e2e).
- [ ] The NCTB template applies and the checklist shows the right percentage.
- [ ] Reserved and taken slugs are rejected with suggestions; an unverified signup reserves nothing.
- [ ] "Find your school" gives the same response for known and unknown emails (e2e).
- [ ] Only a super-admin can create schools, change plans and extend trials, and each action is in the platform audit log.

---

## 6. M2: Academic structure and staff directory

**Scope:** PRD 6.4 (without batch mode) and the staff directory (decision 4 of PRD v1.3).

### 6.1 Sessions, terms, shifts, rooms

- [ ] Academic years: validate `start < end` and no overlap; `GET /academic-years/current`. Keep the `academic_years` table name; the UI calls them sessions.
- [ ] `terms (academic_year_id, name, start_date, end_date, sort_order)` with CRUD.
- [ ] `shifts (name, start_time, end_time, sort_order)` with CRUD.
- [ ] `rooms (name, building, capacity, type)` with CRUD (used by exams and timetable later).
- [ ] Catalog keys and seed updates for the three new resources.

### 6.2 Per-session sections

- [ ] New `sections (academic_year_id, class_id, shift_id nullable, name, capacity, room_id nullable, is_active)`, unique `(org_id, academic_year_id, class_id, name)`, with RLS and grants.
- [ ] Migration `PerSessionSections`:
  - [ ] For each `class_sections` row, create a section in every year that has enrollments, teacher assignments or timetable rows for that class + section; otherwise in the current year.
  - [ ] Repoint `student_enrollments`, `class_teachers`, `subject_teachers` and `class_timetables` `section_id` to the new rows (match on class + old section + year).
  - [ ] Drop `class_sections` and the old `sections`.
- [ ] Remove the global section-name CRUD and `classes/:classId/sections` routes.
- [ ] New routes: `GET/POST /sections?academicYearId=&classId=`, `PATCH/DELETE /sections/:id`.

### 6.3 Curriculum and subject components

- [ ] `subjects`: keep `(org, code)` unique; drop `is_optional`.
- [ ] `class_subjects`: add `subject_type` (compulsory/optional/fourth/elective) and `subject_group_id` nullable; drop `is_compulsory`.
- [ ] `class_subject_components (class_subject_id, component cq|mcq|practical|written|oral, full_marks, pass_marks, sort_order)` with CRUD under the class subject.
- [ ] Enrollments gain `subject_group_id`.
- [ ] `student_subjects` gains `is_fourth_subject`; at most one per enrollment, and only for a `fourth`/`optional` class subject.
- [ ] Add the missing PATCH on `class-subject-groups`.

### 6.4 Effective-dated teacher assignments

- [ ] `class_teachers` and `subject_teachers`: add `effective_from` (default session start) and `effective_to` (nullable); current-assignment unique keys become partial (`WHERE effective_to IS NULL`).
- [ ] `subject_teachers` references `class_subject_id` instead of `class_id + subject_id`.
- [ ] Changing a teacher closes the old row and opens a new one in one transaction.
- [ ] Delete only for a row created in error (no dependent data); otherwise end-date it.
- [ ] Add the missing PATCH on `subject-teachers`.
- [ ] `TeachingService.activeAssignments(employeeId, date)` (feeds `AccessScope`) and `assignmentOn(sectionId, classSubjectId, date)` (history).

### 6.5 Session rollover

- [ ] `POST /academic-years/:targetId/rollover { fromYearId, include: { sections, curriculum, teachers }, mode? }` as a job, in one transaction.
- [ ] Copies sections, class subjects with components and groups, and current teacher assignments, with new ids.
- [ ] Refuses when the target already has rows of an included kind, unless `mode: 'merge'` (skips existing names).
- [ ] Never touches enrollments.

### 6.6 Staff directory

- [ ] `employees`: generated `employee_number` via `NumberingService` (overridable), Bangla name, NID (encrypted), photo file, employment type.
- [ ] `POST /employees/:id/invite` uses the M0 invite flow with the employee's email or phone and a default role by designation.
- [ ] Staff Excel import through the import framework (M3) with type `staff`.

### Done when

- [ ] A session with shifts, terms, per-session sections and curriculum with components can be built from the NCTB template (e2e).
- [ ] The section migration runs cleanly on a copy of the dev database with existing data.
- [ ] Teacher changes keep history, and `assignmentOn` answers who taught a subject on a past date.
- [ ] Rollover copies a session and refuses to overwrite.
- [ ] A scoped teacher sees only their own sections (e2e).

---

## 7. M3: Student information system

**Scope:** PRD 6.6 (transfers within the school) and the Excel import from 6.2.

### 7.1 Profile and status

- [ ] `students`: add `name_bn`, `birth_reg_no`, `blood_group`, `previous_school`; `photo_file_id` replaces `photo_url`.
- [ ] Platform `geo_divisions`, `geo_districts`, `geo_upazilas` seeded from BBS data; `GET /public/geo/...`; addresses gain `division_id`, `district_id`, `upazila_id`.
- [ ] **Student ID:** `admission_number` generated from the org pattern (`{YY}{CLASS}{SEQ:4}` default) at create or import; manual value only when the setting allows it.
- [ ] **Status lifecycle:**
  - [ ] Enum `active`, `suspended`, `transferred`, `left`, `graduated`, `dropped_out` (`applicant` comes with admissions); migration maps `inactive` → `left`.
  - [ ] `POST /students/:id/status { status, reason, effectiveDate }` validates transitions and writes `student_status_history`.
  - [ ] Plain PATCH can no longer change status.
- [ ] **Search:** `pg_trgm` GIN indexes on English and Bangla names; search by name, ID, phone and guardian phone; filters by class, section, status, gender, religion.
- [ ] Student list export (Excel/PDF) as a job.

### 7.2 Guardians and portal accounts

- [ ] Relation enum `father`, `mother`, `local_guardian`, `brother`, `sister`, `other`; add `occupation`, `income`, `nid` (encrypted), `name_bn`.
- [ ] Partial unique `(org_id, phone) WHERE deleted_at IS NULL` on guardians (also the import match key).
- [ ] Every guardian gets a user account (email or phone) and an ACTIVE guardian membership on create or import.
- [ ] Students get an account only when their class qualifies under `org_settings.portal` (re-checked at promotion).
- [ ] All account creation goes through `OrgUserService` and the invite flow; no hand-set passwords.

### 7.3 Enrollment, transfers, promotion

- [ ] Enrollment validation: section belongs to the class and year; capacity (override with `enrollments:override_capacity`); student active; roll unique per section.
- [ ] **Transfers:** `POST /enrollments/:id/transfer { sectionId, reason, effectiveDate }` writes `enrollment_changes` and updates the enrollment.
- [ ] **Promotion** (replaces `student_promotions`):
  - [ ] `promotion_batches (from_year_id, to_year_id, class_id, status draft|committed|rolled_back, options jsonb {rollBy merit|keep|alphabetical, shuffleSections}, committed_at, committed_by)`.
  - [ ] `promotion_batch_items (enrollment_id, outcome promote|detain|conditional|graduate, to_class_id, to_section_id, new_roll, overridden, note)`.
  - [ ] `POST /promotions/batches` builds the draft (outcome from the published combined result when it exists, else promote) and computes rolls and sections; `GET` is the preview.
  - [ ] `PATCH /promotions/batches/:id/items/:itemId` for manual overrides.
  - [ ] `POST /promotions/batches/:id/commit` (job, one transaction): create next-year enrollments, mark old ones `promoted`/`completed`, graduate the final class.
  - [ ] `POST /promotions/batches/:id/rollback` within 24 hours, only if nothing references the new enrollments.
  - [ ] Migration drops `student_promotions` (moving any rows into a closed legacy batch).

### 7.4 Excel import (PRD 6.2)

- [ ] `src/modules/imports/`: `imports (type students|guardians|staff|marks, file_id, status uploaded|validating|validated|committing|done|failed, mode all_or_nothing|valid_only, totals jsonb, errors jsonb [{row, column, code, message}])`.
- [ ] `GET /imports/templates/:type`: a generated workbook with headers, examples and data-validation lists.
- [ ] `POST /imports` (upload) → validation job: required fields, formats, phone normalization, duplicates in the file and against the DB, class/section existence.
- [ ] `GET /imports/:id`: row-level preview.
- [ ] `POST /imports/:id/commit` (job): students, guardians (matched by phone), links, enrollments and portal accounts; one transaction for `all_or_nothing`, per-row savepoints for `valid_only`.
- [ ] 500 students validate and commit in well under a minute.

### 7.5 Documents, health, notes

- [ ] Documents: `file_id` replaces `file_url`; `verification_status` (pending/verified/rejected) with `verified_by`/`verified_at`.
- [ ] Health: medical record fields encrypted; the student 360 view omits health without `student_medical:read`.
- [ ] Notes: `health`, `disciplinary` and `counselling` types need `student_notes:read_sensitive`, enforced in the repository query.

### 7.6 Certificates, ID cards, student 360

- [ ] `certificates (student_id, type tc|testimonial|character|study, serial, issued_at, issued_by, data jsonb, status valid|revoked, revoke_reason, verify_token)`; serial from `NumberingService`.
- [ ] One fixed PDF layout per certificate type, with a QR code to `https://<host>/verify/<token>`.
- [ ] `GET /public/certificates/verify/:token` returns name, type, issue date and status only.
- [ ] ID cards: one fixed layout, bulk PDF per section with photo and QR; `students.rfid_card_no` column.
- [ ] `GET /students/:id/overview` (student 360): profile, enrollment, guardians; attendance, results and fees summaries added as M4–M6 land.

### Done when

- [ ] 500 students with guardians import from the template, showing row errors before commit, in both modes (e2e).
- [ ] Promotion previews, commits and rolls back within 24 hours (e2e).
- [ ] Student IDs follow the configured pattern with no duplicates under concurrency.
- [ ] Sensitive notes and health data are hidden without the permission (e2e).
- [ ] A certificate QR code verifies on the public endpoint, and a revoked one shows as revoked.

---

## 8. M4: Attendance and student leave

**Scope:** PRD 6.7 student attendance, online only (offline sync and alerts are 1b).

### 8.1 Model

- [ ] `holidays (date_from, date_to, name, type public|school|religious, applies_to all|class ids)`; the BD template from M1 applies.
- [ ] `attendance_statuses (code, label_en, label_bn, counts_as present|absent|late|leave|half_day, is_system, sort_order)`, seeded with Present, Absent, Late, Leave, Half-day.
- [ ] `attendance_registers (section_id, date, period_id nullable, taken_by, submitted_at, client_request_id)`, unique `(org_id, section_id, date, coalesce(period_id))`.
- [ ] `attendance_records (register_id, enrollment_id, status_code, remark, updated_by, updated_at)`, unique `(register_id, enrollment_id)`.
- [ ] `attendance_corrections (record_id, old_status, new_status, changed_by, changed_at, reason, source manual|sync_overwrite)`.

### 8.2 Marking

- [ ] `GET /attendance/sections/:sectionId?date=`: roster of active enrollments on that date with current statuses, defaulting to Present.
- [ ] `PUT /attendance/sections/:sectionId?date=`: exceptions only, `Idempotency-Key`, one-transaction bulk upsert (< 1 s for 50 students).
- [ ] Rejected on holidays and weekend days (`ATTENDANCE_HOLIDAY`).
- [ ] Rejected outside the user's scope (`attendance:take`, assigned sections).
- [ ] Changes to submitted records require a reason and write a correction.
- [ ] Records older than the lock window require `attendance:edit_locked`.
- [ ] `GET /attendance/submission-status?date=` lists sections not yet submitted.
- [ ] Domain event `attendance.submitted` recorded for the 1b absentee-alert job; nothing is sent in 1a.

### 8.3 Student leave

- [ ] `student_leave_requests (enrollment_id, from_date, to_date, reason, attachment_file_id, status pending|approved|rejected, applied_by_user_id, decided_by, decided_at)`.
- [ ] Guardians apply through `/portal` (M7); the class teacher (scope) approves or rejects.
- [ ] Approval pre-fills Leave in the registers for those dates; overwriting it with Absent needs a correction.

### 8.4 Reports

- [ ] Daily summary by class and section.
- [ ] Monthly register PDF in the paper register layout (A4/Legal landscape).
- [ ] Defaulters below X%.
- [ ] Late-comers.
- [ ] Unit suite for summary and percentage math.

### Done when

- [ ] The 1a acceptance criteria of PRD 6.7 pass in e2e: holiday block, lock, correction audit, scope, submission tracking.
- [ ] Saving 50 students takes under 1 second on the performance seed.
- [ ] The monthly register PDF matches the paper layout (checked against a sample register).

---

## 9. M5: Exams and results

**Scope:** PRD 6.9 core cycle. Exam routine, seat plans, admit cards, invigilators and the report-card designer are Phase 2.

### 9.1 Grading engine (pure TypeScript)

- [ ] `src/modules/grading/engine/` with no Nest or DB dependencies.
- [ ] Per-subject: component marks → marks, grade, point, pass/fail per component (minimum pass per component).
- [ ] Overall: total, GPA, grade, failed-subject count; F in any compulsory subject → overall F.
- [ ] 4th-subject bonus: point − 2.0 when above 2.0, GPA capped at 5.00.
- [ ] Grace marks (max per subject and total, only to reach pass); absent and exempt handling; rounding to 2 decimals.
- [ ] Combined results: weighted per-subject marks across exams, then graded.
- [ ] Positions: section and class merit with configurable tie-breakers (GPA, total, compulsory total, roll).
- [ ] **Regression suites** (PRD 11.5):
  - [ ] BD GPA 5.0: board cases for 4th subject, compulsory F, component pass and grace.
  - [ ] GPA 4.0
  - [ ] Cambridge A*–U
  - [ ] Percentage/division
  - [ ] Alia madrasa

### 9.2 Model

- [ ] `grading_systems (name, kind gpa|letter|percentage, rules jsonb)` and `grade_scale_items (grading_system_id, letter, min_mark, max_mark, point, is_fail)`, created from templates.
- [ ] `class_grading (academic_year_id, class_id, grading_system_id)`.
- [ ] `exam_types (name, default_weight)`.
- [ ] `exams (academic_year_id, term_id, exam_type_id, name, weight, start_date, end_date, status)`.
- [ ] `exam_subjects (exam_id, class_subject_id, full_marks, pass_marks)` and `exam_subject_components` copied from the class subject, editable per exam.
- [ ] `mark_sheets (exam_subject_id, section_id, status draft|submitted|verified|approved|published, submitted/verified/approved/reopened by and at, reopen_reason)`, unique per exam subject and section.
- [ ] `marks (mark_sheet_id, enrollment_id, component_id, value numeric(6,2) nullable, absent, exempt)`, unique `(mark_sheet_id, enrollment_id, component_id)`.
- [ ] `result_definitions (academic_year_id, class_id, name, items [{exam_id, weight}])`; single-exam results use an implicit definition.
- [ ] `results (result_definition_id, enrollment_id, total, gpa, grade, position_section, position_class, failed_count, computed_at, published_at)` and `result_subjects (result_id, class_subject_id, marks, grade, point, passed)`.

### 9.3 Workflow

- [ ] `GET/PUT /mark-sheets/:id/marks` for the grid; the response includes engine-computed grades.
- [ ] Marks Excel import through the import framework (type `marks`).
- [ ] Transitions:
  - [ ] submit (`results:enter`, subject-teacher scope)
  - [ ] verify (`results:verify`, only when `verifyStep` is on)
  - [ ] approve (`results:approve`); approved sheets are read-only
  - [ ] publish (`results:publish`, per result definition and class)
  - [ ] `POST /mark-sheets/:id/reopen { reason }` (`results:reopen`) back to draft
- [ ] Every value change after first submission writes an audit row with old and new values.
- [ ] Tabulation job runs when all sheets of a definition are approved, and again after reopen and re-approval; publish is blocked until results are current.
- [ ] Publishing makes results visible on the portal and notifies guardians (M7 notifications).

### 9.4 Report cards and sheets

- [ ] Two fixed layouts (Bangla and English variants), with options from settings: logo, letterhead, signatures, remarks, attendance summary, co-curricular grades.
- [ ] `PUT /results/:id/remarks` for the class teacher.
- [ ] Bulk generation per section on the `pdf` queue: one PDF per student (stored, signed URL) plus a merged section PDF.
- [ ] Merit list, tabulation sheet, failed list and subject-wise analysis as Excel and PDF.

### Done when

- [ ] Every grading regression suite passes 100%.
- [ ] A mark sheet goes draft → published, with and without the verify step (e2e).
- [ ] Approved marks can't be edited; reopen is audited with old and new values (e2e).
- [ ] 500 report cards render in under 2 minutes on the performance seed.

---

## 10. M6: Fees

**Scope:** PRD 6.10 with counter collection (online payments and reconciliation are 1b).

### 10.1 Setup

- [ ] `fee_heads (name, name_bn, frequency monthly|quarterly|yearly|one_time, is_active)`.
- [ ] `fee_structures (academic_year_id, class_id, subject_group_id nullable, shift_id nullable, effective_from, effective_to)` and `fee_structure_items (fee_structure_id, fee_head_id, amount, due_day, months int[] nullable)`.
- [ ] `discount_types (name, kind percent|fixed, value, applies_to_head_ids, code sibling|merit|staff_child|freedom_fighter|custom)`.
- [ ] `student_discounts (student_id, discount_type_id, value_override, from_period, to_period, status pending|approved|rejected, requested_by, decided_by)`; only approved discounts apply (`fees:approve_waiver`).
- [ ] `late_fine_rules (fee_head_id nullable, kind fixed|per_day, amount, grace_days, max_amount)`.

### 10.2 Invoices

- [ ] `invoices (number, student_id, enrollment_id, period, issue_date, due_date, status open|partially_paid|paid|cancelled, total, discount_total, fine_total, net_total, allocated_total, bank_reference)`.
- [ ] `invoice_lines (invoice_id, fee_head_id, period, description, amount, discount, fine, net, allocated)`, unique `(org_id, student_id, fee_head_id, period)`.
- [ ] Monthly generation: scheduled per org on the billing day, plus `POST /invoices/generate { period, classIds? }` (job with progress), applying structures and approved discounts.
- [ ] Ad-hoc invoices (fines, events): `POST /invoices`.
- [ ] Daily late-fine job adds fine lines once per rule and invoice.
- [ ] Cached totals updated only inside the allocation transaction; a nightly job recomputes them from allocations and alerts on drift.

### 10.3 Collection, allocation, receipts

- [ ] `payments (number, student_id nullable, payer_guardian_id nullable, channel cash|cheque|card|bank_slip, amount, reference, received_by, received_at, status completed|reversed, idempotency_key)`.
- [ ] `payment_allocations (payment_id, invoice_line_id, amount)`.
- [ ] `POST /payments { amount, allocations? }` (`fees:collect`):
  - [ ] Locks target lines with `SELECT … FOR UPDATE`.
  - [ ] Allocates oldest-due first by default, or as given.
  - [ ] Rejects over-allocation of the payment or of a line.
  - [ ] Can span several invoices and several children of one guardian.
- [ ] `receipts (number, payment_id, issued_at, issued_by, status valid|cancelled, cancel_reason, cancelled_by)`; number from `NumberingService` in the payment transaction (gap-free).
- [ ] Receipt cancellation (`fees:cancel_receipt`) needs a reason and creates `payment_reversals`, which releases the allocations; the original stays visible.
- [ ] Receipt PDF in thermal 80 mm and A4; in-app/email confirmation to the guardian.
- [ ] `adjustments (type refund|waiver|correction, invoice_line_id, amount, reason, status pending|approved|rejected, requested_by, decided_by)`; only approved adjustments change balances.

### 10.4 Dues and reports

- [ ] Due list by class and section with aging buckets (0–30, 31–60, 61–90, 90+ days).
- [ ] Email/in-app due reminders on a configurable schedule (SMS **(1b)**).
- [ ] `blockResultsOnDues` setting hides published results on the portal until dues are cleared.
- [ ] Reports: collection vs. demand, head-wise collection, discount report, defaulters, daily collection per collector.
- [ ] **Fee regression suite** (PRD 11.5): discounts, fines, generation, allocation, plus property-based tests of "billed − discounts − collected = outstanding" and "line outstanding = net − allocations" over random payment sequences.

### 10.5 Expenses and ledger

- [ ] `expense_categories` and `expenses (voucher_no, category_id, amount, paid_from cash|bank, date, note, attachment_file_ids)`.
- [ ] Single-entry `ledger_entries (date, direction income|expense, account cash|bank, amount, source_type, source_id)` written by payments, reversals, refunds and expenses.
- [ ] Cash book and bank book reports.
- [ ] If M6 runs long, this section moves to the start of Phase 1b (open point 3).

### Done when

- [ ] Receipts are gap-free under concurrent collection (e2e).
- [ ] Cancellation needs a reason and permission, and the cancelled receipt stays visible.
- [ ] Each collector's daily report reconciles to their receipts.
- [ ] The outstanding invariants hold, and completed payments can't be edited or deleted.
- [ ] The fee regression suite passes 100%.

---

## 11. M7: Notices, notifications, portal, dashboards

**Scope:** PRD 6.13 Phase 1a, 6.14 web portal, 6.22 Phase 1a set.

### 11.1 Notices

- [ ] `notices (title, body, attachment file ids, audience jsonb {type all|role|class|section|group|users, ids}, publish_at, expires_at, pinned, is_public, created_by)` and `notice_reads (notice_id, user_id, read_at)`.
- [ ] `GET /notices/feed` resolves the audience for the viewer (roles, own or children's sections, staff assignments).
- [ ] Public notices on the school home page: `GET /public/organizations/:slug/home`.

### 11.2 Notifications

- [ ] `NotificationService.notify({ recipients, templateKey, vars, channels })` writes in-app rows and enqueues email; SMS and push plug into the same call **(1b)**.
- [ ] `notifications (user_id, type, title, body, link, read_at)`; `GET /notifications`, `POST /notifications/:id/read`, `POST /notifications/read-all`.
- [ ] `notification_templates (key, channel, locale, subject, body)` per org overriding code defaults (absent, fee due, payment received, result published, notice published), in Bangla and English.
- [ ] `delivery_logs (channel, recipient, template_key, status queued|sent|failed, provider_message_id, error, created_at)`; `GET /communication-log`.
- [ ] Queue retries with backoff.

### 11.3 Portal API (`/portal/*`)

- [ ] `PortalAccessService.linkedEnrollments(userId)`: guardian links via `guardians.user_id` → `student_guardians`, or the student's own `students.user_id`. Every portal query filters by it.
- [ ] `GET /portal/children`: this school's children, plus children at other schools (from the user's other memberships) with their host.
- [ ] `POST /portal/handoff { orgId }`: handoff code for another school where the user has an active membership.
- [ ] `GET /portal/children/:id/dashboard`: today's attendance, upcoming exams, dues, latest notices.
- [ ] Attendance history.
- [ ] Results and report-card download (signed URL; respects the dues block).
- [ ] Invoices, payment history and receipt PDFs.
- [ ] Notices.
- [ ] `POST /portal/children/:id/leave`.
- [ ] IDOR e2e suite: a guardian can't reach another family's student on any portal or staff endpoint.

### 11.4 Dashboards and reports

- [ ] `GET /dashboards/admin`: enrollment, attendance today, collection today and month-to-date, dues, staff count, upcoming events.
- [ ] `GET /dashboards/teacher`: today's sections, pending attendance and mark sheets.
- [ ] `GET /dashboards/accountant`: collection, dues.
- [ ] Redis cache for 60 seconds per org.
- [ ] Large exports through `report_exports` jobs and signed URLs.

### Done when

- [ ] A guardian with two children sees only them, and is notified when results are published (e2e).
- [ ] A guardian with children at two schools can switch between them through a handoff (e2e).
- [ ] Dashboards load in under 2 seconds on the 5,000-student performance seed.
- [ ] The communication log shows every email sent, with its status.

---

## 12. M8: Settings completion and pilot hardening

**Scope:** the rest of PRD 6.24 Phase 1a, and the "Pilot hardening" row of PRD 12.2.

- [ ] **Data export:** `POST /settings/export` (owner/admin, audited) job writes one CSV per tenant table through the tenant connection, plus a manifest, into a zip in storage, then emails a signed link.
- [ ] **Localization:** every mail, notification and PDF template in Bangla and English; Bangla numerals and lakh-grouped BDT in PDFs; error codes documented for the frontend.
- [ ] **Security review** against PRD 11.4:
  - [ ] Cross-tenant and IDOR suites over students, invoices, documents and exports.
  - [ ] Platform tokens on school APIs and school tokens on platform APIs.
  - [ ] Rate limits on login, signup, find-school, slug check and uploads.
  - [ ] Upload type and size checks.
  - [ ] Helmet and secure headers reviewed.
  - [ ] `npm audit` clean of high/critical issues.
- [ ] **Ops:**
  - [ ] Error tracking (Sentry or similar).
  - [ ] Metrics for queue depth and job failures.
  - [ ] Health checks for Redis and S3.
  - [ ] Postgres PITR backups documented, with a restore drill (RPO 15 minutes).
- [ ] **Performance seed:** a script that creates a 5,000-student school with a year of attendance, one exam cycle and a month of fees.
- [ ] **Pilot onboarding:** platform admin creates the pilot schools, assigns plans, extends trials; sample data off.

### Done when

- [ ] Every PRD 11.5 release criterion has a passing suite or a documented check.
- [ ] A restore from backup has been tested.
- [ ] 3–5 pilot schools are created and onboarded.

---

## 13. Definition of done (every module)

- [ ] Entities extend `OrgScopedEntity` (tenant data) with per-org unique keys; the migration enables RLS, creates the policy and grants the app role.
- [ ] Every endpoint has `@RequirePermissions` with catalog keys, and system-role seeds are updated.
- [ ] Section or subject data is filtered through `AccessScope`; query builders filter by `orgId`.
- [ ] Audited actions call `AuditService.record` inside the transaction.
- [ ] DTOs validate every input; list endpoints paginate with `findPage`.
- [ ] Swagger decorators (`@ApiBearerAuth('tenant-jwt')`, `@ApiHeader({ name: 'x-tenant-id' })`) and response messages are in place.
- [ ] Unit specs cover the service rules; e2e specs cover the PRD acceptance criteria plus a cross-tenant case.
- [ ] The module is imported in `app.module.ts`, and `app.module.spec.ts` passes.
- [ ] A `.http` sample file sits next to the controller.
- [ ] This plan is ticked and updated to match what was built.

---

## 14. Phase 1b outline

Tracked here so Phase 1a leaves room for it. Each becomes a full milestone when 1b planning starts.

- [ ] **Online payments:** `payment_intents`, SSLCommerz and bKash adapters behind a `PaymentGateway` interface; success only from a verified webhook or server-side status check; idempotent on the provider transaction id; reconciliation status and a mismatch screen; bank statement import.
- [ ] **SMS:** `SmsProvider` interface with a BD provider and failover; `sms_wallets` and `sms_ledger` with balance checks and an emergency-broadcast overdraw limit; masking sender IDs; absentee alerts on `attendance.submitted` (once per student per day); SMS OTP for signup, activation, passwordless login and phone "Find your school".
- [ ] **Push:** Web Push subscriptions per session as a `NotificationService` channel.
- [ ] **Offline attendance sync:** the idempotent `PUT` with `client_request_id` and device timestamps; overwrites write a `sync_overwrite` correction.
- [ ] **Subscription billing:** platform invoices from active-student counts, proration, gateway payment, past-due → suspended job, read-only enforcement for suspended schools (fee payment still allowed).
- [ ] **Platform roles and impersonation:** support/sales/finance roles; consent windows granted by a school admin; `impersonator_id` in `audit_logs`.
- [ ] **Staff attendance and leave:** staff registers on the attendance model; leave types with quotas and multi-level approval.
- [ ] **File virus scanning** for uploads.

---

## 15. Open points to confirm during M0

- [ ] **Existing data:** is there production or pilot data yet? If not, the M2 section refactor, the M3 promotion replacement and the M0 identity change can skip their data back-fill steps.
- [ ] **Certificates and ID cards** (7.6) are P0 in PRD 6.6 but not in the PRD 12.2 timeline. Kept in M3 with fixed layouts; could move to 1b if the pilot doesn't need them.
- [ ] **Expenses and ledger** (10.5) may slip to the start of Phase 1b.
- [ ] **Request context library:** `nestjs-cls` for actor/IP/request id in `AuditService`, unless the existing pino context already exposes them cleanly.
