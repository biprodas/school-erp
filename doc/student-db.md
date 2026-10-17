# Student Database Schema

This document describes the student data model for the School ERP: the core
student record and its profile satellites — addresses, documents, medical
profile, emergency contacts, and internal notes.

It reflects the **implemented** TypeORM entities under
`backend/src/modules/students/` (`entities/`, `enums/`). Every table described
here has a corresponding entity in the codebase. All tables live in the single
shared `public` schema and are scoped to a school (`organizations` row) by
`org_id`.

## Overview

`Student` is the core identity record. It deliberately holds only
student-specific identity and contact fields; everything that is multi-valued,
sensitive, or historical is split into dedicated satellite tables that reference
the student. This keeps the `students` table lean and lets each concern grow
independently.

Capabilities supported:

- A single canonical student identity with an optional login account
- Multiple structured addresses (present / permanent)
- File attachments (certificates, IDs, photos) with verification + expiry
- A one-to-one medical profile
- Prioritised emergency contacts (who need not be guardians)
- Internal staff notes, categorised and authored

**Out of the student tables but closely related** (documented elsewhere):

- **Guardians** — `guardians` + `student_guardians` link table, in
  `backend/src/modules/guardians/`.
- **Enrollment / placement** — `student_enrollments`, `student_subjects`, and
  `student_promotions`, covered in [`academic-db.md`](./academic-db.md). A
  student's class, section, roll number, and academic-year placement live there,
  **not** on `students`.

**Conventions used across every table:**

- Primary key `id` is a `uuid` (`@PrimaryGeneratedColumn('uuid')`).
- Every entity extends `OrgScopedEntity`
  (`backend/src/tenancy/org-scoped.entity.ts`), which adds an indexed, NOT NULL
  `org_id` uuid column with an FK to `organizations.id` (`ON DELETE CASCADE` —
  deleting a school deletes all of its student data). `OrgScopedEntity` adds no
  other columns; `id` and the audit columns are declared on each entity.
- Audit columns `created_at` and `updated_at` exist on every table.
- `students`, `student_documents`, and `student_notes` additionally support soft
  delete via `deleted_at`.
- Every satellite's `student_id` is `ON DELETE CASCADE` — deleting a student
  removes its profile rows.
- Multi-tenancy is enforced twice on `org_id`: at the repository layer
  (`BaseTenantRepository` pins every find/save/update/delete to the request's
  org) and in Postgres by the `org_isolation` row-level-security policy.
- Uniqueness is per school: every unique index includes `org_id` as its first
  column.
- Enum-like fields are stored as short `varchar` columns validated in code.

## 1. Student Profile Map

```
Student
  ├── Address           (many; one per type)        student_addresses
  ├── Document          (many; soft-delete)          student_documents
  ├── Medical Record    (one-to-one)                 student_medical_records
  ├── Emergency Contact (many; priority-ordered)     student_emergency_contacts
  ├── Note              (many; soft-delete)           student_notes
  │
  ├── Guardian          (many-to-many)   ──► guardians module
  └── Enrollment        (per year)        ──► academic-db.md
```

## 2. `students`

The core student identity. Class/section/roll placement is **not** stored here —
it lives on `student_enrollments` (see `academic-db.md`), since it is per
academic year.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | Auto-generated |
| `org_id` | uuid | FK → `organizations.id` (CASCADE), Not Null, Indexed | Inherited from `OrgScopedEntity`; tenant discriminator (RLS) |
| `admission_number` | varchar(60) | Not Null, unique per org | School-assigned admission no. |
| `first_name` | varchar | Not Null | |
| `middle_name` | varchar | Nullable | |
| `last_name` | varchar | Not Null | |
| `dob` | date | Nullable | Date of birth |
| `gender` | varchar(16) | Nullable | Enum `StudentGender` |
| `religion` | varchar(60) | Nullable | |
| `nationality` | varchar(60) | Nullable | |
| `email` | varchar | Nullable | Student's own email |
| `phone` | varchar(40) | Nullable | |
| `photo_url` | text | Nullable | Profile photo |
| `address` | text | Nullable | Free-text quick address; structured addresses live in `student_addresses` |
| `admission_date` | date | Nullable | When the student was admitted |
| `admission_type` | varchar(16) | Nullable | Enum `AdmissionType` |
| `status` | varchar | Not Null, default `active` | Enum `StudentStatus` |
| `user_id` | uuid | FK → `users.id` (SET NULL), Nullable | Optional login account |
| `created_at` | timestamp | Not Null | |
| `updated_at` | timestamp | Not Null | |
| `deleted_at` | timestamp | Nullable | Soft delete |

**Unique index:** `uq_students_org_admission_number` on (`org_id`,
`admission_number`) — admission numbers are unique within a school.

**Virtual field:** `fullName` is computed (not stored) from
`first_name` + `middle_name` + `last_name` on load/insert/update.

Relations:

- `org` — ManyToOne → `Organization` (inherited, `CASCADE`)
- `user` — ManyToOne → `User` (nullable, `SET NULL`; `users` is the global,
  non-tenanted accounts table)
- `guardians` — OneToMany → `StudentGuardian`
- `addresses` / `documents` / `emergencyContacts` / `notes` — OneToMany
- `medicalRecord` — OneToOne → `StudentMedicalRecord`

Enums:

```ts
enum StudentGender { MALE = 'male', FEMALE = 'female', OTHER = 'other' }

enum StudentStatus {
  ACTIVE = 'active', INACTIVE = 'inactive',
  GRADUATED = 'graduated', TRANSFERRED = 'transferred',
}

enum AdmissionType {
  NEW = 'new', TRANSFER = 'transfer', READMISSION = 'readmission',
}
```

**Example row:**

| admission_number | first_name | last_name | gender | admission_type | status |
|---|---|---|---|---|---|
| `2026-0101` | `Ayesha` | `Khan` | female | new | active |

## 3. `student_addresses`

A structured address for a student. Each student may hold at most one address of
each type.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `org_id` | uuid | FK → `organizations.id` (CASCADE), Not Null, Indexed | Inherited from `OrgScopedEntity`; tenant discriminator (RLS) |
| `student_id` | uuid | FK → `students.id` (CASCADE), Not Null | |
| `address_type` | varchar(16) | Not Null | Enum `AddressType` |
| `address_line_1` | varchar(255) | Not Null | |
| `address_line_2` | varchar(255) | Nullable | |
| `city` | varchar(120) | Nullable | |
| `district` | varchar(120) | Nullable | |
| `state` | varchar(120) | Nullable | |
| `postal_code` | varchar(20) | Nullable | |
| `country` | varchar(120) | Nullable | |
| `created_at` | timestamp | Not Null | |
| `updated_at` | timestamp | Not Null | |

**Unique index:** `uq_student_address_type` on (`org_id`, `student_id`, `address_type`).

```ts
enum AddressType { PRESENT = 'present', PERMANENT = 'permanent' }
```

## 4. `student_documents`

A file attachment for a student, with verification and optional validity dates.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `org_id` | uuid | FK → `organizations.id` (CASCADE), Not Null, Indexed | Inherited from `OrgScopedEntity`; tenant discriminator (RLS) |
| `student_id` | uuid | FK → `students.id` (CASCADE), Not Null | |
| `document_type` | varchar(32) | Not Null | Enum `DocumentType` |
| `title` | varchar(160) | Nullable | Display label |
| `file_url` | text | Not Null | Stored file location |
| `issue_date` | date | Nullable | |
| `expiry_date` | date | Nullable | |
| `verified` | boolean | Not Null, default `false` | Staff verification flag |
| `created_by` | uuid | Nullable | User who uploaded (from the JWT) |
| `created_at` | timestamp | Not Null | |
| `updated_at` | timestamp | Not Null | |
| `deleted_at` | timestamp | Nullable | Soft delete |

**Index:** `idx_student_document_student` on (`student_id`).

```ts
enum DocumentType {
  BIRTH_CERTIFICATE    = 'birth_certificate',
  PASSPORT             = 'passport',
  NATIONAL_ID          = 'national_id',
  TRANSFER_CERTIFICATE = 'transfer_certificate',
  MEDICAL_CERTIFICATE  = 'medical_certificate',
  PHOTO                = 'photo',
  OTHER                = 'other',
}
```

> **Scope note:** documents are student-scoped today. If employees later need
> attachments, this can be generalised into a shared polymorphic `documents`
> table (`owner_type` + `owner_id`) without changing the API shape.

## 5. `student_medical_records`

A student's current medical profile. One-to-one with the student; the API
upserts (create on first write, update thereafter).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `org_id` | uuid | FK → `organizations.id` (CASCADE), Not Null, Indexed | Inherited from `OrgScopedEntity`; tenant discriminator (RLS) |
| `student_id` | uuid | FK → `students.id` (CASCADE), Not Null | |
| `blood_group` | varchar(8) | Nullable | e.g. `O+` |
| `height_cm` | numeric(5,2) | Nullable | |
| `weight_kg` | numeric(5,2) | Nullable | |
| `allergies` | text | Nullable | |
| `medical_conditions` | text | Nullable | |
| `disabilities` | text | Nullable | |
| `doctor_name` | varchar(160) | Nullable | |
| `doctor_phone` | varchar(40) | Nullable | |
| `insurance_info` | text | Nullable | |
| `created_at` | timestamp | Not Null | |
| `updated_at` | timestamp | Not Null | |

**Unique index:** `uq_student_medical_record` on (`org_id`, `student_id`) —
enforces the one-to-one relationship.

## 6. `student_emergency_contacts`

A person to contact in an emergency. Not necessarily a guardian. Listed in
ascending `priority` order.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `org_id` | uuid | FK → `organizations.id` (CASCADE), Not Null, Indexed | Inherited from `OrgScopedEntity`; tenant discriminator (RLS) |
| `student_id` | uuid | FK → `students.id` (CASCADE), Not Null | |
| `name` | varchar(160) | Not Null | |
| `relation` | varchar(60) | Nullable | Free-text relationship |
| `phone` | varchar(40) | Not Null | |
| `alternate_phone` | varchar(40) | Nullable | |
| `priority` | int | Not Null, default `1` | Lower = contacted first |
| `created_at` | timestamp | Not Null | |
| `updated_at` | timestamp | Not Null | |

**Index:** `idx_student_emergency_contact_student` on (`student_id`).

## 7. `student_notes`

Internal staff notes about a student, categorised by type and attributed to the
author.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `org_id` | uuid | FK → `organizations.id` (CASCADE), Not Null, Indexed | Inherited from `OrgScopedEntity`; tenant discriminator (RLS) |
| `student_id` | uuid | FK → `students.id` (CASCADE), Not Null | |
| `note_type` | varchar(16) | Not Null, default `general` | Enum `NoteType` |
| `note` | text | Not Null | |
| `created_by` | uuid | Nullable | Author (from the JWT) |
| `created_at` | timestamp | Not Null | |
| `updated_at` | timestamp | Not Null | |
| `deleted_at` | timestamp | Nullable | Soft delete |

**Index:** `idx_student_note_student` on (`student_id`).

```ts
enum NoteType {
  GENERAL = 'general', ACADEMIC = 'academic', BEHAVIOR = 'behavior',
  HEALTH = 'health', DISCIPLINARY = 'disciplinary', OTHER = 'other',
}
```

## 8. API Surface

All routes are tenant-scoped (`x-tenant-id` header + tenant JWT, `JwtAuthGuard`
+ `PermissionsGuard`) and guarded by RBAC permissions from the catalog
(`backend/src/modules/rbac/permissions.catalog.ts`). Controllers live in
`backend/src/modules/students/controllers/` and `backend/src/modules/guardians/`.

| Resource | Route | Permissions |
|---|---|---|
| Student | `/students` (CRUD) | `students:*` |
| Address | `/students/:studentId/addresses` (CRUD) | `students:*` |
| Document | `/students/:studentId/documents` (CRUD) | `student_documents:*` |
| Medical record | `/students/:studentId/medical-record` (GET / PUT / DELETE) | `student_medical:read` / `:update` / `:delete` |
| Emergency contact | `/students/:studentId/emergency-contacts` (CRUD) | `students:*` |
| Note | `/students/:studentId/notes` (CRUD) | `student_notes:*` |
| Guardian | `/guardians` (CRUD) | `guardians:*` |
| Guardian link | `/students/:studentId/guardians` (CRUD) | `guardians:*` |

"CRUD" here means `GET` (list), `POST`, `PATCH /:id` and `DELETE /:id`, mapped
to the resource's `read` / `create` / `update` / `delete` permission. `/students`
and `/guardians` also expose `GET /:id`.

The medical record is a singleton per student: `GET` returns it (or `null`),
`PUT` upserts (it is guarded by `student_medical:update` even when it creates
the row; `student_medical:create` exists in the catalog but no route uses it),
`DELETE` clears it.

Documents, medical records, and notes carry **dedicated** permissions because
they are sensitive or standalone; addresses and emergency contacts reuse
`students:*` as core profile data. Seeded roles: `admin` has everything; `staff`
gets full CRUD on documents/medical/notes; `teacher` gets read on
documents/notes (medical excluded for privacy).

## 9. Entity-Relationship Diagram

```
users ──(SET NULL)── students
                        │
   ┌────────────────────┼─────────────────────────┐
   │        │        │       │        │            │
   ▼        ▼        ▼       ▼        ▼            ▼
addresses documents medical_record emergency_contacts notes
(1 per     (many)   (one-to-one)   (many)            (many)
 type)

students ──< student_guardians >── guardians         (guardians module)
students ──< student_enrollments >── …               (academic-db.md)
```

Legend: `A ──< B` means "one A, many B" (B holds the FK). Every satellite's FK to
`students` is `ON DELETE CASCADE`. Not drawn: every table above (including
`students`) also has `org_id` → `organizations.id` (`ON DELETE CASCADE`).

## 10. Implemented Tables

| Group | Tables |
|---|---|
| Core | `students` |
| Profile satellites | `student_addresses`, `student_documents`, `student_medical_records`, `student_emergency_contacts`, `student_notes` |
| Related (other modules) | `guardians`, `student_guardians` (guardians); `student_enrollments`, `student_subjects`, `student_promotions` (academic) |

### Design notes

- **Lean core, rich satellites.** `students` carries identity and quick-contact
  fields only. Multi-valued, sensitive, and historical data are separate tables.
- **Placement is per-year, not on the student.** Class, section, and roll number
  belong to `student_enrollments` so the same student record spans many sessions.
- **No status-history table.** Lifecycle/audit history is intentionally deferred
  to a future general-purpose audit-log, rather than a student-specific table.
- **Deferred (future phase):** student categories, houses, structured
  disabilities, sibling links, and medical history — all dropped from the
  original draft to keep this phase focused on the core profile.
