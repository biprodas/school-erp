# Academic Database Schema

This document describes the academic data model for the School ERP: academic
years, classes and sections, subjects and subject groups, the per-year
curriculum, student enrollment and elective selection, teacher assignments, and
the class timetable.

It reflects the **implemented** TypeORM entities under `backend/src/modules/`
(`academic-years/`, `classes/`, `sections/`, `subjects/`, `subject-groups/`,
`class-curriculum/`, `enrollments/`, `promotions/`, `teaching/`, `timetable/`).
Every table described here has a corresponding entity in the codebase. All
tables live in the single shared `public` schema and are scoped to a school
(`organizations` row) by `org_id`.

## Overview

The model is built around a yearly cycle. Most operational data hangs off an
**academic year**, so the same class, section, and subject masters can be reused
season after season while enrollments, curriculum, teaching assignments, and
timetables are scoped per year.

Capabilities supported:

- Multiple academic years / sessions running side by side
- Reusable class and section master lists
- Subject groups / streams (Science, Commerce, Arts, …) and elective subjects
- Per-class, per-year subject offerings with marks and weekly load
- Multiple teachers per class and per subject
- Student enrollment per year with roll numbers and lifecycle status
- A weekly class timetable down to day + period

**Conventions used across every table:**

- Primary key `id` is a `uuid` (`@PrimaryGeneratedColumn('uuid')`).
- Every entity extends `OrgScopedEntity`
  (`backend/src/tenancy/org-scoped.entity.ts`), which adds an indexed, NOT NULL
  `org_id` uuid column with an FK to `organizations.id` (`ON DELETE CASCADE` —
  deleting a school deletes all of its academic data). `OrgScopedEntity` adds no
  other columns; `id` and the audit columns are declared on each entity.
- Audit columns `created_at` and `updated_at` exist on every table
  (`student_subjects` and `student_promotions` carry only `created_at`).
- `academic_years` additionally supports soft delete via `deleted_at`.
- Multi-tenancy is enforced twice on `org_id`: at the repository layer
  (`BaseTenantRepository` pins every find/save/update/delete to the request's
  org) and in Postgres by the `org_isolation` row-level-security policy.
- Uniqueness is per school: every unique index includes `org_id` as its first
  column, so two schools can both have a `2026` year or a `Class 9`.
- All foreign keys are declared `ON DELETE CASCADE`, except the nullable
  section FKs on `student_promotions` (`SET NULL`).
- Enum-like fields are stored as short `varchar` columns with a default value.

## 1. Academic Hierarchy

```
Academic Year
    │
    ├── Class
    │      ├── Section            (via class_sections)
    │      ├── Subject            (via class_subjects)
    │      └── Subject Group      (via class_subject_groups)
    │                 └── Subject (via subject_group_subjects)
    │
    └── Student Enrollment
               └── Student Subject (elective picks)
```

Concrete example — Class 9 offering two streams in the 2026 session:

```
2026 Session
│
└── Class 9
    ├── Section A
    ├── Section B
    │
    ├── Science Group
    │   ├── Physics
    │   ├── Chemistry
    │   ├── Biology
    │   └── Higher Math
    │
    └── Commerce Group
        ├── Accounting
        ├── Finance
        └── Business Studies
```

## 2. Master Tables

These tables are year-agnostic catalogs. They are defined once and referenced by
the per-year linking tables in later sections.

### 2.1 `academic_years`

A session/year that scopes enrollment, curriculum, and scheduling.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | Auto-generated |
| `org_id` | uuid | FK → `organizations.id` (CASCADE), Not Null, Indexed | Inherited from `OrgScopedEntity`; tenant discriminator (RLS) |
| `name` | varchar(80) | Not Null, unique per org | e.g. `2026` |
| `code` | varchar(40) | Nullable | Short code, e.g. `AY26` |
| `start_date` | date | Nullable | Session opening date |
| `end_date` | date | Nullable | Session closing date |
| `is_current` | boolean | Not Null, default `false` | Marks the active session |
| `is_active` | boolean | Not Null, default `true` | Soft enable/disable |
| `description` | text | Nullable | |
| `created_at` | timestamp | Not Null | |
| `updated_at` | timestamp | Not Null | |
| `deleted_at` | timestamp | Nullable | Soft delete |

**Unique index:** `uq_academic_years_org_name` on (`org_id`, `name`).

**Example rows:**

| name | code | start_date | end_date | is_current |
|---|---|---|---|---|
| `2025` | `AY25` | 2025-01-01 | 2025-12-15 | false |
| `2026` | `AY26` | 2026-01-01 | 2026-12-15 | true |

### 2.2 `classes`

The master list of classes/grades.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `org_id` | uuid | FK → `organizations.id` (CASCADE), Not Null, Indexed | Inherited from `OrgScopedEntity`; tenant discriminator (RLS) |
| `name` | varchar(120) | Not Null, unique per org | e.g. `Class 9` |
| `code` | varchar(40) | Nullable | e.g. `C9` |
| `level` | int | Nullable | Numeric rank used for sorting/promotion order |
| `description` | text | Nullable | |
| `is_active` | boolean | Not Null, default `true` | |
| `created_at` | timestamp | Not Null | |
| `updated_at` | timestamp | Not Null | |

**Unique index:** `uq_classes_org_name` on (`org_id`, `name`).

Relations:

- `classSections` — OneToMany → `ClassSection`

**Example rows:** `Play`, `Nursery`, `KG`, `Class 1` … `Class 12` (with
`level` 0, 1, 2, 3 … 14 to drive ordering).

### 2.3 `sections`

The master list of sections, shared across classes.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `org_id` | uuid | FK → `organizations.id` (CASCADE), Not Null, Indexed | Inherited from `OrgScopedEntity`; tenant discriminator (RLS) |
| `name` | varchar(60) | Not Null, unique per org | e.g. `A` |
| `code` | varchar(40) | Nullable | |
| `description` | text | Nullable | |
| `is_active` | boolean | Not Null, default `true` | |
| `created_at` | timestamp | Not Null | |
| `updated_at` | timestamp | Not Null | |

**Unique index:** `uq_sections_org_name` on (`org_id`, `name`).

Relations:

- `classLinks` — OneToMany → `ClassSection`

**Example rows:** `A`, `B`, `C`, `D`.

### 2.4 `subjects`

The master subject catalog.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `org_id` | uuid | FK → `organizations.id` (CASCADE), Not Null, Indexed | Inherited from `OrgScopedEntity`; tenant discriminator (RLS) |
| `name` | varchar(120) | Not Null, unique per org | e.g. `Physics` |
| `code` | varchar(40) | Nullable, unique per org | e.g. `PHY` |
| `type` | varchar(16) | Not Null, default `theory` | Enum `SubjectType` |
| `is_optional` | boolean | Not Null, default `false` | Elective flag |
| `credit` | int | Nullable | |
| `description` | text | Nullable | |
| `is_active` | boolean | Not Null, default `true` | |
| `created_at` | timestamp | Not Null | |
| `updated_at` | timestamp | Not Null | |

**Unique indexes:** `uq_subjects_org_name` on (`org_id`, `name`) and
`uq_subjects_org_code` on (`org_id`, `code`). Rows with a NULL `code` do not
conflict (Postgres treats NULLs as distinct).

`SubjectType` (`backend/src/modules/subjects/enums/subject-type.enum.ts`):

```ts
enum SubjectType {
  THEORY    = 'theory',
  PRACTICAL = 'practical',
  LAB       = 'lab',
  ACTIVITY  = 'activity',
}
```

**Example rows:**

| name | code | type | is_optional |
|---|---|---|---|
| `Mathematics` | `MATH` | theory | false |
| `Physics` | `PHY` | theory | false |
| `Chemistry Lab` | `CHEML` | lab | false |
| `ICT` | `ICT` | practical | true |

### 2.5 `subject_groups`

A reusable, school-wide stream/grouping of subjects (Science, Commerce, Arts).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `org_id` | uuid | FK → `organizations.id` (CASCADE), Not Null, Indexed | Inherited from `OrgScopedEntity`; tenant discriminator (RLS) |
| `name` | varchar(120) | Not Null, unique per org | e.g. `Science` |
| `code` | varchar(40) | Nullable | |
| `description` | text | Nullable | |
| `is_active` | boolean | Not Null, default `true` | |
| `created_at` | timestamp | Not Null | |
| `updated_at` | timestamp | Not Null | |

**Unique index:** `uq_subject_groups_org_name` on (`org_id`, `name`).

Relations:

- `subjectLinks` — OneToMany → `SubjectGroupSubject`

**Example rows:** `Science`, `Commerce`, `Arts`, `General`.

### 2.6 `periods`

A named time slot in the daily schedule (used by the timetable).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `org_id` | uuid | FK → `organizations.id` (CASCADE), Not Null, Indexed | Inherited from `OrgScopedEntity`; tenant discriminator (RLS) |
| `name` | varchar(80) | Not Null, unique per org | e.g. `Period 1` |
| `start_time` | time | Nullable | e.g. `09:00` |
| `end_time` | time | Nullable | e.g. `09:45` |
| `display_order` | int | Not Null, default `0` | Ordering within a day |
| `is_active` | boolean | Not Null, default `true` | |
| `created_at` | timestamp | Not Null | |
| `updated_at` | timestamp | Not Null | |

**Unique index:** `uq_periods_org_name` on (`org_id`, `name`).

**Example rows:**

| name | start_time | end_time | display_order |
|---|---|---|---|
| `Period 1` | 09:00 | 09:45 | 1 |
| `Period 2` | 09:45 | 10:30 | 2 |
| `Break` | 10:30 | 10:50 | 3 |

## 3. Class Composition

### 3.1 `class_sections`

Links a class to a section, carrying the per-class-section capacity. A section
(e.g. `A`) can attach to many classes; each `(class, section)` pair is unique.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `org_id` | uuid | FK → `organizations.id` (CASCADE), Not Null, Indexed | Inherited from `OrgScopedEntity`; tenant discriminator (RLS) |
| `class_id` | uuid | FK → `classes.id` (CASCADE), Not Null | `schoolClass` |
| `section_id` | uuid | FK → `sections.id` (CASCADE), Not Null | `section` |
| `capacity` | int | Nullable | Max seats |
| `is_active` | boolean | Not Null, default `true` | |
| `created_at` | timestamp | Not Null | |
| `updated_at` | timestamp | Not Null | |

**Unique index:** `uq_class_section` on (`org_id`, `class_id`, `section_id`).

**Example:** Class 5 → A (40), Class 5 → B (40), Class 5 → C (38).

## 4. Curriculum (per academic year)

These tables tie the master catalogs to a class **for a specific academic
year**, so the curriculum can evolve year over year.

### 4.1 `class_subject_groups`

A subject group made available to a class in a given year.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `org_id` | uuid | FK → `organizations.id` (CASCADE), Not Null, Indexed | Inherited from `OrgScopedEntity`; tenant discriminator (RLS) |
| `class_id` | uuid | FK → `classes.id` (CASCADE), Not Null | |
| `subject_group_id` | uuid | FK → `subject_groups.id` (CASCADE), Not Null | |
| `academic_year_id` | uuid | FK → `academic_years.id` (CASCADE), Not Null | |
| `created_at` | timestamp | Not Null | |
| `updated_at` | timestamp | Not Null | |

**Unique index:** `uq_class_subject_group` on (`org_id`, `class_id`, `subject_group_id`, `academic_year_id`).

**Example:** in 2026, Class 9 → Science, Class 9 → Commerce, Class 9 → Arts.

### 4.2 `subject_group_subjects`

Membership of a subject within a subject group.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `org_id` | uuid | FK → `organizations.id` (CASCADE), Not Null, Indexed | Inherited from `OrgScopedEntity`; tenant discriminator (RLS) |
| `subject_group_id` | uuid | FK → `subject_groups.id` (CASCADE), Not Null | |
| `subject_id` | uuid | FK → `subjects.id` (CASCADE), Not Null | |
| `is_compulsory` | boolean | Not Null, default `true` | Compulsory within the group |
| `display_order` | int | Not Null, default `0` | |
| `created_at` | timestamp | Not Null | |
| `updated_at` | timestamp | Not Null | |

**Unique index:** `uq_subject_group_subject` on (`org_id`, `subject_group_id`, `subject_id`).

**Example:**

```
Science
 ├── Physics      (compulsory)
 ├── Chemistry    (compulsory)
 ├── Biology      (compulsory)
 └── Higher Math  (optional)
```

### 4.3 `class_subjects`

A subject offered to a class in a given year, with grading and weekly load.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `org_id` | uuid | FK → `organizations.id` (CASCADE), Not Null, Indexed | Inherited from `OrgScopedEntity`; tenant discriminator (RLS) |
| `class_id` | uuid | FK → `classes.id` (CASCADE), Not Null | |
| `subject_id` | uuid | FK → `subjects.id` (CASCADE), Not Null | |
| `academic_year_id` | uuid | FK → `academic_years.id` (CASCADE), Not Null | |
| `is_compulsory` | boolean | Not Null, default `true` | |
| `weekly_classes` | int | Nullable | Periods per week |
| `pass_marks` | int | Nullable | |
| `full_marks` | int | Nullable | |
| `created_at` | timestamp | Not Null | |
| `updated_at` | timestamp | Not Null | |

**Unique index:** `uq_class_subject` on (`org_id`, `class_id`, `subject_id`, `academic_year_id`).

**Example rows (Class 5, 2026):**

| subject | is_compulsory | weekly_classes | pass_marks | full_marks |
|---|---|---|---|---|
| English | true | 6 | 33 | 100 |
| Bangla | true | 6 | 33 | 100 |
| Mathematics | true | 7 | 33 | 100 |

## 5. Enrollment

### 5.1 `student_enrollments`

A student's placement (class + section) for one academic year. This is the
central operational table.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `org_id` | uuid | FK → `organizations.id` (CASCADE), Not Null, Indexed | Inherited from `OrgScopedEntity`; tenant discriminator (RLS) |
| `student_id` | uuid | FK → `students.id` (CASCADE), Not Null | |
| `academic_year_id` | uuid | FK → `academic_years.id` (CASCADE), Not Null | |
| `class_id` | uuid | FK → `classes.id` (CASCADE), Not Null | |
| `section_id` | uuid | FK → `sections.id` (CASCADE), Not Null | |
| `roll_no` | varchar(40) | Nullable | |
| `status` | varchar(16) | Not Null, default `active` | Enum `StudentEnrollmentStatus` |
| `created_at` | timestamp | Not Null | |
| `updated_at` | timestamp | Not Null | |

**Unique indexes:**

- `uq_enrollment_student_year` on (`org_id`, `student_id`, `academic_year_id`) — one
  enrollment per student per year.
- `uq_enrollment_roll` on (`org_id`, `academic_year_id`, `class_id`, `section_id`, `roll_no`)
  — roll numbers are unique within a section per year. Because `roll_no` is
  nullable and Postgres treats NULLs as distinct, any number of enrollments
  without a roll number can coexist.

`StudentEnrollmentStatus`:

```ts
enum StudentEnrollmentStatus {
  ACTIVE      = 'active',
  PROMOTED    = 'promoted',
  TRANSFERRED = 'transferred',
  LEFT        = 'left',
  COMPLETED   = 'completed',
}
```

Relations:

- `student` / `academicYear` / `schoolClass` / `section` — ManyToOne
- `subjects` — OneToMany → `StudentSubject`

**Example:** Student 101 · Session 2026 · Class 8 · Section A · Roll `15` ·
status `active`.

### 5.2 `student_subjects`

A subject (typically an elective) chosen by an enrolled student.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `org_id` | uuid | FK → `organizations.id` (CASCADE), Not Null, Indexed | Inherited from `OrgScopedEntity`; tenant discriminator (RLS) |
| `student_enrollment_id` | uuid | FK → `student_enrollments.id` (CASCADE), Not Null | |
| `subject_id` | uuid | FK → `subjects.id` (CASCADE), Not Null | |
| `created_at` | timestamp | Not Null | No `updated_at` on this table |

**Unique index:** `uq_student_subject` on (`org_id`, `student_enrollment_id`, `subject_id`).

**Example:** Student 101's enrollment picks `ICT`, `Higher Math`, `Biology`.

### 5.3 `student_promotions`

An audit record of a student's movement between classes across academic years.
Each row captures the `from` → `to` transition explicitly. The entity and its API
live in `backend/src/modules/promotions/` (`entities/student-promotion.entity.ts`,
`promotion.controller.ts`, `promotion.service.ts`).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `org_id` | uuid | FK → `organizations.id` (CASCADE), Not Null, Indexed | Inherited from `OrgScopedEntity`; tenant discriminator (RLS) |
| `student_id` | uuid | FK → `students.id` (CASCADE), Not Null | |
| `from_year_id` | uuid | FK → `academic_years.id` (CASCADE), Not Null | Source session |
| `to_year_id` | uuid | FK → `academic_years.id` (CASCADE), Not Null | Destination session |
| `from_class_id` | uuid | FK → `classes.id` (CASCADE), Not Null | |
| `to_class_id` | uuid | FK → `classes.id` (CASCADE), Not Null | |
| `from_section_id` | uuid | FK → `sections.id` (SET NULL), Nullable | |
| `to_section_id` | uuid | FK → `sections.id` (SET NULL), Nullable | |
| `promotion_date` | date | Nullable | When the promotion took effect |
| `created_at` | timestamp | Not Null | No `updated_at` on this table |

**Indexes:** only the inherited index on `org_id`. There is **no** unique index
on (`org_id`, `student_id`, `from_year_id`, `to_year_id`) today, so the database
does not prevent duplicate transition records for the same student and year
pair.

Relations:

- `student` — ManyToOne → `Student`
- `fromYear` / `toYear` — ManyToOne → `AcademicYear`
- `fromClass` / `toClass` — ManyToOne → `Class`
- `fromSection` / `toSection` — ManyToOne → `Section` (nullable, `SET NULL`)

> **How promotion works today (`POST /promotions`):** the service checks that the
> referenced student, both academic years, both classes and any given sections
> exist in the current school (404 otherwise), then inserts this
> `student_promotions` row. It does **not** touch `student_enrollments`: the
> source enrollment's status is not changed to `promoted` and no destination
> enrollment is created, so those must be managed separately via the
> enrollments API. Duplicate transitions are not rejected.
>
> Endpoints (`promotion.controller.ts`): `GET /promotions` (filter by `id`,
> `studentId`, `fromYearId`, `toYearId`) and `GET /promotions/:id` require
> `promotions:read`; `POST /promotions` requires `promotions:create`;
> `DELETE /promotions/:id` requires `promotions:delete`. There is no
> `PATCH /promotions/:id`; `promotions:update` exists in the catalog but no
> route uses it.
>
> **Planned (not implemented):** a transactional workflow that marks the source
> enrollment `promoted`, creates the destination enrollment (defaulting the
> section, leaving the roll number blank) and writes the audit row, rejecting
> the request if the student has no source enrollment, is already enrolled in
> the destination year, or the transition already exists; plus a `PATCH`
> endpoint that amends only the audit record.

**Example:** Student 101 · 2025 Class 7 A → 2026 Class 8 A · promoted 2026-01-05.

## 6. Teaching Assignments

### 6.1 `class_teachers`

Assigns an employee as a class teacher of a class-section for a year.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `org_id` | uuid | FK → `organizations.id` (CASCADE), Not Null, Indexed | Inherited from `OrgScopedEntity`; tenant discriminator (RLS) |
| `class_id` | uuid | FK → `classes.id` (CASCADE), Not Null | |
| `section_id` | uuid | FK → `sections.id` (CASCADE), Not Null | |
| `employee_id` | uuid | FK → `employees.id` (CASCADE), Not Null | The teacher |
| `academic_year_id` | uuid | FK → `academic_years.id` (CASCADE), Not Null | |
| `is_primary` | boolean | Not Null, default `false` | Primary vs assistant class teacher |
| `created_at` | timestamp | Not Null | |
| `updated_at` | timestamp | Not Null | |

**Unique index:** `uq_class_teacher` on (`org_id`, `academic_year_id`, `class_id`, `section_id`, `employee_id`).

**Example:** 2026 · Class 7 · A → Mr. Karim (`is_primary = true`).

### 6.2 `subject_teachers`

Assigns an employee to teach a subject to a class-section for a year.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `org_id` | uuid | FK → `organizations.id` (CASCADE), Not Null, Indexed | Inherited from `OrgScopedEntity`; tenant discriminator (RLS) |
| `class_id` | uuid | FK → `classes.id` (CASCADE), Not Null | |
| `section_id` | uuid | FK → `sections.id` (CASCADE), Not Null | |
| `subject_id` | uuid | FK → `subjects.id` (CASCADE), Not Null | |
| `employee_id` | uuid | FK → `employees.id` (CASCADE), Not Null | The teacher |
| `academic_year_id` | uuid | FK → `academic_years.id` (CASCADE), Not Null | |
| `created_at` | timestamp | Not Null | |
| `updated_at` | timestamp | Not Null | |

**Unique index:** `uq_subject_teacher` on (`org_id`, `academic_year_id`, `class_id`, `section_id`, `subject_id`, `employee_id`).

**Example:** 2026 · Class 8 · A · Mathematics → Mr. Rahman.

## 7. Timetable

### 7.1 `class_timetables`

One scheduled slot: a subject taught by an employee to a class-section on a given
weekday and period.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `org_id` | uuid | FK → `organizations.id` (CASCADE), Not Null, Indexed | Inherited from `OrgScopedEntity`; tenant discriminator (RLS) |
| `academic_year_id` | uuid | FK → `academic_years.id` (CASCADE), Not Null | |
| `class_id` | uuid | FK → `classes.id` (CASCADE), Not Null | |
| `section_id` | uuid | FK → `sections.id` (CASCADE), Not Null | |
| `day_of_week` | varchar(12) | Not Null | Enum `DayOfWeek` |
| `period_id` | uuid | FK → `periods.id` (CASCADE), Not Null | |
| `subject_id` | uuid | FK → `subjects.id` (CASCADE), Not Null | |
| `employee_id` | uuid | FK → `employees.id` (CASCADE), Not Null | The teacher |
| `created_at` | timestamp | Not Null | |
| `updated_at` | timestamp | Not Null | |

**Unique index:** `uq_timetable_slot` on (`org_id`, `academic_year_id`, `class_id`, `section_id`, `day_of_week`, `period_id`) — one subject per slot.

`DayOfWeek`: `monday`, `tuesday`, `wednesday`, `thursday`, `friday`,
`saturday`, `sunday`.

**Example:** 2026 · Class 8 · A · Monday · Period 1 → Mathematics, Mr. Rahman.

## 8. Entity-Relationship Diagram

```
academic_years
   │
   ├──< student_enrollments >── students
   │            │
   │            └──< student_subjects >── subjects
   │
   ├──< student_promotions >── students  (from_year_id / to_year_id)
   │
   ├──< class_subject_groups >── subject_groups ──< subject_group_subjects >── subjects
   │
   ├──< class_subjects >── subjects
   │
   ├──< class_teachers >── employees
   │
   ├──< subject_teachers >── subjects / employees
   │
   └──< class_timetables >── periods / subjects / employees

classes ──< class_sections >── sections
classes ─── (referenced by every per-year table above)
```

Legend: `A ──< B` means "one A, many B" (B holds the FK). Not drawn: every
table above also has `org_id` → `organizations.id` (`ON DELETE CASCADE`).
`employees` belongs to the employees module (`backend/src/modules/employees/`).

## 9. End-to-End Example

Setting up Class 9 Science for the 2026 session and scheduling one period.
Identifiers are shown as readable labels; in the database they are UUIDs.

1. **Create the academic year.**

   ```json
   { "name": "2026", "code": "AY26", "isCurrent": true }
   ```

2. **Define the class and its sections** (master rows + `class_sections`).

   ```
   classes:        Class 9 (level 9)
   sections:       A, B
   class_sections: (Class 9, A, capacity 40), (Class 9, B, capacity 40)
   ```

3. **Catalog the subjects.** Physics, Chemistry, Biology, Higher Math, ICT — set
   `type` and `is_optional` per subject (e.g. ICT `practical`, optional).

4. **Build the Science group** (`subject_groups` + `subject_group_subjects`).

   ```
   Science → Physics (compulsory), Chemistry (compulsory),
             Biology (compulsory), Higher Math (optional)
   ```

5. **Make the group available to Class 9 for 2026** (`class_subject_groups`):
   `(Class 9, Science, 2026)`.

6. **Set per-class subject offerings** (`class_subjects`), with marks and load:

   ```json
   { "classId": "Class 9", "subjectId": "Physics", "academicYearId": "2026",
     "isCompulsory": true, "weeklyClasses": 5, "passMarks": 33, "fullMarks": 100 }
   ```

7. **Enroll a student** (`student_enrollments`):

   ```json
   { "studentId": "Student 101", "academicYearId": "2026",
     "classId": "Class 9", "sectionId": "A", "rollNo": "15", "status": "active" }
   ```

8. **Record elective picks** (`student_subjects`) against that enrollment:
   `Higher Math`, `ICT`.

9. **Assign teachers.**

   ```
   class_teachers:   (2026, Class 9, A, Mr. Karim, isPrimary true)
   subject_teachers: (2026, Class 9, A, Physics, Mr. Rahman)
   ```

10. **Schedule a timetable slot** (`class_timetables`):

    ```json
    { "academicYearId": "2026", "classId": "Class 9", "sectionId": "A",
      "dayOfWeek": "monday", "periodId": "Period 1",
      "subjectId": "Physics", "employeeId": "Mr. Rahman" }
    ```

## 10. Implemented Tables

All sixteen tables below are implemented as TypeORM entities under
`backend/src/modules/` (all extend `OrgScopedEntity`), grouped by concern:

| Group | Tables |
|---|---|
| Master catalogs | `academic_years`, `classes`, `sections`, `subjects`, `subject_groups`, `periods` |
| Class composition | `class_sections` |
| Curriculum (per year) | `class_subject_groups`, `subject_group_subjects`, `class_subjects` |
| Enrollment | `student_enrollments`, `student_subjects`, `student_promotions` |
| Teaching | `class_teachers`, `subject_teachers` |
| Timetable | `class_timetables` |

A minimal academic setup needs only the master catalogs plus `class_sections`,
`class_subjects`, `student_enrollments`, and the teaching-assignment tables; the
subject-group, elective, promotion, and timetable tables layer richer
curriculum and scheduling on top without changing the core design.
