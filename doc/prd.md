# School ERP: Product Requirements Document

| Field        | Value                                                  |
| ------------ | ------------------------------------------------------ |
| Product      | School ERP: multi-tenant school management SaaS       |
| Version      | 1.5                                                    |
| Date         | 2026-10-18                                             |
| Status       | Draft                                                  |
| Market focus | Bangladesh first, built so it can go global            |

**Changes in 1.5:** Google sign-in moves into Phase 1a (6.3); Microsoft sign-in is dropped.

**Changes in 1.4:** Managing committee / governing body added (6.25): a Committee Member system role in Phase 1a, the committee module in Phase 2.

**Changes in 1.3:** Phase 1a no longer depends on SMS (email verification, email/phone + password login). Identity accepts email or phone. Classes are permanent and sections are per session. A minimal staff directory joins the MVP. Exams, communication, settings and platform admin are trimmed for Phase 1a. Branches move to Phase 3. Results verification is optional. Technical choices for queues, PDFs and file storage are recorded. Open question 7 is resolved.

---

## Table of contents

1. [Overview](#1-overview)
2. [Goals, non-goals and success metrics](#2-goals-non-goals-and-success-metrics)
3. [Market and positioning](#3-market-and-positioning)
4. [Personas and roles](#4-personas-and-roles)
5. [SaaS platform and tenancy model](#5-saas-platform-and-tenancy-model)
6. [Functional requirements](#6-functional-requirements)
7. [Core user workflows](#7-core-user-workflows)
8. [Non-functional requirements](#8-non-functional-requirements)
9. [Integrations](#9-integrations)
10. [Core data entities](#10-core-data-entities)
11. [Testing and release criteria](#11-testing-and-release-criteria)
12. [Release roadmap](#12-release-roadmap)
13. [Risks, assumptions and open questions](#13-risks-assumptions-and-open-questions)
14. [Glossary](#14-glossary)

---

## 1. Overview

### 1.1 Problem statement

Most schools in Bangladesh still run on paper registers, Excel sheets, and one-off desktop software or several separate apps:

- **Fees** are collected over the counter, reconciled by hand, and dues are chased by phone.
- **Results** are tabulated in spreadsheets, which leads to GPA errors and late report cards.
- **Attendance** sits in registers. Guardians only find out a child was absent days later, if at all.
- **Communication** is spread across ad-hoc SMS, Facebook groups and printed notices.
- **Data** is not backed up, sits on one office PC, and cannot be accessed remotely.
- **School groups** with several branches have no consolidated view.

The existing software is mostly desktop-bound, hard to configure, English-only, poorly supported on mobile, and expensive to customize per school.

### 1.2 Vision

> One affordable, mobile-first platform where any school can run academics, finance, people and communication. Every stakeholder (owner, teacher, accountant, student, guardian) gets the information they need in their own language, on the device they already have.

### 1.3 Product principles

1. **Mobile-first.** Teachers take attendance and guardians pay fees from a phone. Every core flow works on a 360 px screen.
2. **Configurable, not custom.** Grading rules, fee heads, terms, shifts, roles and report-card layouts are settings, not code changes.
3. **Multi-tenant by design.** Every school's data is strictly isolated. One codebase and one deployment serve every customer.
4. **Low-bandwidth tolerant.** Pages stay light, the app is an installable PWA, and attendance can be captured offline and synced later.
5. **Bangla and English everywhere.** The UI, SMS templates, report cards and receipts work in both languages.
6. **Automate the busywork.** Invoices, reminders, absentee alerts, tabulation and payslips are generated, not typed.
7. **Trust and transparency.** Every financial and academic change has an audit trail.
8. **Self-serve onboarding.** A school can sign up and be operational within one day without a sales call.

---

## 2. Goals, non-goals and success metrics

### 2.1 Goals

- G1. Replace paper and spreadsheet workflows for the core school operations: admission, attendance, exams, fees and notices.
- G2. Increase on-time fee collection through online payments and automated reminders.
- G3. Give guardians real-time visibility into attendance, results, fees and notices.
- G4. Cut the time to publish results from weeks to days.
- G5. Run as a profitable, self-serve SaaS that scales to thousands of schools on shared infrastructure.

### 2.2 Non-goals (v1)

- Being a full university ERP. Credit-hour registration, thesis tracking and research grants are out of scope.
- Running video conferencing. We integrate with Zoom, Google Meet and Jitsi rather than building our own.
- A general-purpose accounting package. We provide a school ledger and exports, not a full double-entry GL with tax filing.
- Hardware sales. We integrate with standard RFID and biometric devices but do not manufacture them.
- Building a student social network or public forums.

### 2.3 Success metrics

| Metric                                                     | Target (12 months after GA)       |
| ---------------------------------------------------------- | --------------------------------- |
| Time from signup to first attendance taken                 | < 24 hours (median)               |
| Paying schools                                             | 500                               |
| Students under management                                  | 250,000                           |
| Share of fee collected online, among schools that enable it | ≥ 40%                             |
| Weekly active teachers / total teachers                    | ≥ 70%                             |
| Weekly active guardians / total guardians                  | ≥ 35%                             |
| Result publication time after the last exam                | ≤ 3 days                          |
| Monthly logo churn                                         | < 2%                              |
| NPS (school admins)                                        | ≥ 40                              |
| Platform uptime                                            | ≥ 99.9%                           |
| P1 support tickets resolved within SLA                     | ≥ 95%                             |

---

## 3. Market and positioning

### 3.1 Target segments

| Segment                                 | Size / notes                                                       | Priority |
| --------------------------------------- | ------------------------------------------------------------------ | -------- |
| Private K-12 schools (Bangla & English medium) | Largest addressable segment; 200–3,000 students each        | Primary  |
| English-medium schools (Cambridge/Edexcel) | Higher willingness to pay; need O/A-level grading               | Primary  |
| Madrasas (Alia & Qawmi)                 | Need Arabic subjects, Hijri dates, and their own grading schemes   | Secondary |
| Colleges (HSC, degree pass)             | Group-based subjects, board registration                           | Secondary |
| Coaching centers                        | Batches instead of classes, monthly fees, short courses (batch mode, 6.4, Phase 2) | Secondary |
| School groups / chains                  | Multi-branch; need consolidated reporting                           | Primary (upsell) |
| International (South Asia, Africa, Middle East) | Need pluggable grading, currencies and gateways             | Later    |

### 3.2 Competitive positioning

- **Local desktop or hosted tools:** cheap but dated, weak on mobile, no real multi-tenancy, poor support.
- **Global ERPs:** feature-rich but expensive, with no bKash/Nagad support, no BD grading, and no Bangla.
- **Our wedge:** modern UX plus BD-native flows (GPA 5.0, MFS payments, Bangla SMS, board-exam exports), together with self-serve onboarding and transparent per-student pricing.

### 3.3 Pricing and packaging

| Plan     | Target                       | Includes                                                                                           |
| -------- | ---------------------------- | -------------------------------------------------------------------------------------------------- |
| Free     | ≤ 100 students, trial / tiny | SIS, attendance, notices, basic results; platform branding; 1 admin                                 |
| Basic    | Small schools                | Free plan + fees & online payment, report cards, guardian portal, SMS (pay-per-use)                 |
| Standard | Mid-size schools             | Basic + HR & payroll, timetable, LMS/homework, library, custom roles, custom domain                 |
| Premium  | Large schools & groups       | Standard + transport, hostel, inventory, multi-branch, analytics, API access, priority support, AI   |

- Billing is **per active student per month**, paid monthly or annually (annual = 2 months free), with a minimum monthly fee.
- **Add-on modules** can be bought on lower plans: transport, hostel, LMS, AI.
- **SMS credits** are prepaid bundles, with separate rates for masking and non-masking SMS.
- **Trial:** 30 days of the Standard plan, no card required.
- **Currency:** BDT for Bangladesh; USD for international customers, with region-specific prices.

---

## 4. Personas and roles

### 4.1 Platform-side personas

| Persona                      | Goals                                                                    |
| ---------------------------- | ------------------------------------------------------------------------ |
| **Platform super-admin**     | Manage all schools, plans and billing; suspend or restore; view platform health |
| **Platform support agent**   | Resolve tickets; impersonate a school user (with consent and an audit trail) |
| **Sales / onboarding**       | Create schools on a customer's behalf, extend trials, apply discounts     |

### 4.2 School-side personas

| Persona                     | Primary needs                                                                          |
| --------------------------- | -------------------------------------------------------------------------------------- |
| **Owner / Chairman**        | Financial overview, enrollment trends, multi-branch comparison, from a phone           |
| **School admin**            | Set up the school, manage users and roles, oversee every module                        |
| **Principal / Head teacher** | Academic oversight, exam approvals, staff attendance, notices                         |
| **Accountant**              | Fee collection, dues, waivers, expenses, payroll disbursement, financial reports       |
| **Teacher**                 | Take attendance, enter marks, assign homework, message guardians                       |
| **Class teacher**           | Teacher needs plus section-level attendance, report-card remarks and student welfare   |
| **Admission officer / Receptionist** | Handle enquiries, admission forms, visitor log, certificate requests          |
| **Librarian**               | Catalog, issue and return, fines                                                       |
| **Transport manager**       | Routes, vehicles, drivers, student allocation, live tracking                           |
| **Hostel warden**           | Rooms, allocation, hostel attendance, mess, visitors                                   |
| **Store keeper**            | Inventory, purchases, asset issue                                                      |
| **HR officer**              | Staff records, leave, payroll                                                          |
| **Managing committee member** | President, member secretary, guardian/teacher representatives, donor members: oversight of finance, results and enrollment, meetings and resolutions (6.25) |

### 4.3 Portal personas

| Persona      | Primary needs                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| **Student**  | Timetable, homework, results, attendance, study material, notices                                    |
| **Guardian** | Child's attendance alerts, results, fee dues and online payment, notices, messaging teachers; covers several children with one login |
| **Alumnus**  | Directory, events, certificates, donations                                                           |

### 4.4 Default role × module access matrix

Legend: **F** = full, **W** = create/edit within scope, **R** = read-only, **O** = own records only, blank = no access. Each school can clone and customize roles (see 6.3).

The Owner is not a separate role: the owner holds the OWNER membership with school-admin rights, so they have the Admin column. Two-way guardian messaging (Communication, "reply") arrives in Phase 2.

**Committee Member** (not a column, to keep the table readable): R on school settings, academic setup, dashboards and reports, including finance reports, collection, dues and result summaries. No access to individual students' health, discipline or guardian details, no write access anywhere, and nothing in HR beyond staff counts. In Phase 2 they also get the committee module (6.25): own meetings, minutes and resolutions.

| Module            | Admin | Principal | Accountant | Teacher | Class teacher | Receptionist | Librarian | Student | Guardian |
| ----------------- | ----- | --------- | ---------- | ------- | ------------- | ------------ | --------- | ------- | -------- |
| School settings   | F     | R         |            |         |               |              |           |         |          |
| Users & roles     | F     |           |            |         |               |              |           |         |          |
| Academic setup    | F     | W         |            | R       | R             |              |           |         |          |
| Admissions        | F     | W         | R          |         |               | W            |           |         |          |
| Students (SIS)    | F     | W         | R          | R       | W (own section) | R          | R         | O       | O        |
| Attendance        | F     | W         |            | W (own classes) | W (own section) |      |           | O       | O        |
| Timetable         | F     | W         |            | R       | R             |              |           | O       | O        |
| Exams & results   | F     | W (approve) |          | W (own subjects) | W (remarks) |           |           | O       | O        |
| Fees & finance    | F     | R         | F          |         | R (own section) | W (collect) |         | O       | O (pay)  |
| HR & payroll      | F     | R         | W (payroll) | O      | O             | O            | O         |         |          |
| LMS / homework    | F     | R         |            | W       | W             |              |           | O (submit) | R     |
| Communication     | F     | W         | W (fee msgs) | W (own classes) | W     | W            |           | R       | R / reply |
| Library           | F     | R         |            | O       | O             |              | F         | O       | R        |
| Transport, Hostel | F     | R         | R          |         |               |              |           | O       | O        |
| Reports           | F     | W         | W (finance) | R (own) | R (section)  |              | R (library) |       |          |

---

## 5. SaaS platform and tenancy model

### 5.1 Tenancy

- **Tenant = school (organization).** Every school-owned record is tied to exactly one organization and isolated at both the application and the database layer. Cross-tenant access is impossible by construction and covered by automated tests.
- **Global identity.** A person has one account, identified by an email address, a phone number, or both. At least one is required, and each is unique across the platform when present (many guardians have only a phone). That account can hold memberships in several schools, each with its own roles; for example, a teacher who works at two schools, or a guardian whose children attend different schools.
- **Addressing** (design: `domains-and-routing.md`):
  - The product domain (`<product-domain>`) hosts the marketing site, school signup and "Find your school". The platform admin lives on its own host, `admin.<product-domain>`.
  - Every school gets a subdomain, `<slug>.<product-domain>`. The slug is human-readable, chosen at signup, unique, and checked against a reserved list. A renamed slug keeps redirecting for 12 months.
  - Standard and higher plans can map a custom **app host** (`erp.myschool.edu.bd`) with ownership verification and automatic TLS. The school's apex domain (`myschool.edu.bd`) stays the school's own website; hosting it is out of scope for v1.
  - Every school host, subdomain or custom, serves the same routes: `/` school home, `/login`, `/activate`, `/onboarding`, `/dashboard`, `/student`. The subdomain keeps working when a custom domain is active, and can redirect to it.
  - A user who belongs to several schools signs in on each school's host. "Find your school" sends them links to every school where they have an active membership.
- **Branches (campuses)** (Phase 3, the whole feature set below):
  - A school group is a parent organization with several branch organizations.
  - Group-level users see consolidated dashboards and can switch branches.
  - Data stays per branch. Students can be transferred between branches with their history intact.
  - **Group templates**: a group admin maintains shared templates (fee heads and structures, class/subject curriculum, grading systems, notice and SMS templates, report-card and certificate layouts) and pushes them to selected branches. Each branch can override a pushed item locally. A later push shows which branches have overridden it and never silently replaces their local changes.

### 5.2 School lifecycle

```
Signup → Email/phone verification → Provisioning (default roles, settings, sample data optional)
      → Setup wizard → Trial (30 days) → Subscription (paid) ⇄ Past-due (grace 14 days)
      → Suspended (read-only, 30 days) → Archived (data export available 90 days) → Deleted
```

| State     | Behavior                                                                                           |
| --------- | -------------------------------------------------------------------------------------------------- |
| Trial     | All Standard features; banner shows days left; reminders at 7, 3 and 1 days before expiry           |
| Active    | Features per plan and add-ons                                                                       |
| Past-due  | Fully functional; admins see a payment banner; reminders by email and SMS                           |
| Suspended | Read-only; guardians can still pay school fees (the school's revenue is never blocked); no outgoing SMS |
| Archived  | No login except owner export; full data export (CSV + PDF archive)                                  |
| Deleted   | Hard delete of all tenant data and backups after the retention window; deletion certificate emailed |

### 5.3 Platform capabilities

- Subscription and plan management, invoicing and payment collection (card, bKash, bank transfer).
- Feature flags per plan and per school (beta programs, early access).
- Usage metering: active students, SMS sent, storage used.
- Impersonation: support can "log in as" a school user only after the school admin grants time-boxed consent. Every action is recorded in the audit log.
- Platform announcements, both in-app banners and email, sent to all schools or a segment.
- Health dashboard: signups, MRR, churn, active users, error rates, queue backlogs.

---

## 6. Functional requirements

Each module lists its purpose, priority (**P0** = MVP must-have, delivered across Phases 1a and 1b in section 12; **P1** = Phase 2; **P2** = Phase 3 / nice to have), features, key user stories and acceptance criteria.

### 6.1 Platform administration and subscription billing — P0

**Purpose:** let the SaaS operator onboard, bill and support schools.

**Features**

- School directory with search and filters by plan, status, region and student count.
- Create a school on a customer's behalf; edit its profile, plan, limits and trial dates.
- Plan catalog: price per student, minimum fee, included modules, limits (students, storage, users), and an SMS rate card.
- Subscription invoices generated monthly or annually from active student counts; proration on plan changes (Phase 1b).
- Payment collection by card or MFS through a gateway; manual bank-transfer reconciliation (Phase 1b).
- Coupons and discounts (percentage or fixed, time-bound) (Phase 1b).
- Platform users with roles: super-admin, support, sales, finance. Phase 1a has the super-admin only; the other roles arrive in Phase 1b.
- Support tooling: password-reset assistance and tenant data export (Phase 1a); consent-based impersonation (Phase 1b).
- Platform audit log.

**Phase 1a scope:** the super-admin uses the school directory, creates and edits schools, assigns plans and limits by hand, and extends trials. Everything else in this module arrives in Phase 1b.

**User stories**

- As a super-admin, I want to see every school with its plan, status and MRR so that I can spot accounts at risk.
- As a sales agent, I want to extend a school's trial by 15 days so that I can close a deal.
- As a school owner, I want to upgrade my plan from inside the app and pay with bKash so that new modules unlock immediately.

**Acceptance criteria**

- An upgrade takes effect immediately after a successful payment, and the prorated amount appears on the next invoice.
- Unpaid invoices move the school to Past-due on the due date and to Suspended after 14 days, unless an admin overrides it.
- Impersonation is impossible without an active consent window, and every impersonated request is tagged in the audit log.
- Platform tokens can never be used to call school APIs, and school tokens can never call platform APIs.

### 6.2 Onboarding and school setup wizard — P0

**Purpose:** take a new school from signup to operational in under a day.

**Features**

- Self-serve signup on the product domain: school name, type (school/college/madrasa/coaching/English-medium), owner name, email, phone, slug. The slug is suggested from the school name, editable, and checked for availability live.
- Verification by email link in Phase 1a; an SMS OTP for the owner's phone is added in Phase 1b. The school is created only after verification, then the owner is moved to the school's host already signed in and lands on the setup wizard.
- Until the owner completes (or skips) the wizard, school admins are sent to it on sign-in and other users see a "school is being set up" page.
- **Find your school:** a user enters their email (or, from Phase 1b, their phone) and receives sign-in links for every school where they have an active membership. They can also type the school's address. A public directory search is opt-in per school (P1).
- A guided setup wizard with a progress checklist. Each step can be skipped and resumed:
  1. School profile: logo, address, EIIN, contact, principal's signature, currency, time zone, language, week start, weekend days.
  2. Academic session: start and end dates.
  3. Shifts (morning/day), classes, sections for the session, groups (Science/Commerce/Humanities).
  4. Subjects and their class assignment, starting from templates (NCTB curriculum, Cambridge, madrasa).
  5. Grading system (BD GPA 5.0 default template).
  6. Fee heads and a fee structure template.
  7. Add staff to the staff directory and invite them by email or phone (an invite link, or a printed credential slip until SMS arrives in Phase 1b), or bulk-import them from Excel.
  8. Import students and guardians by Excel template, with validation preview.
- Optional sample data mode to try the product.
- In-app guided tours and a help center with Bangla video tutorials.

**User stories**

- As a new school admin, I want to start from the NCTB class/subject template so that I don't type 100 subjects by hand.
- As an admin, I want to upload my existing student list from Excel and see row-level errors before importing so that bad data never enters the system.

**Acceptance criteria**

- A school can finish signup, academic setup and import 500 students in under 60 minutes using the templates.
- A reserved or taken slug is rejected at signup with a suggested alternative, and an unverified signup never reserves a slug.
- "Find your school" gives the same response whether or not the email or phone has an account.
- Excel import validates every row (required fields, duplicates, date formats, phone format), shows the errors inline, and imports only the valid rows or nothing, as the admin chooses.
- The setup checklist shows completion percentage and links to each unfinished step.

### 6.3 Identity, authentication and access control — P0

**Purpose:** secure, simple login for every user type, with fine-grained permissions.

**Features**

- Login with email or mobile number plus password (Phase 1a). Passwordless SMS/email OTP login arrives in Phase 1b.
- Account activation via invite link (Phase 1a) or SMS OTP (Phase 1b); forgot-password and reset flows. Phone-only accounts reset their password through the school admin until SMS OTP is available.
- Optional TOTP two-factor authentication; mandatory for admins and accountants on Premium.
- Google sign-in (Phase 1a), in both realms:
  - It signs in to an existing account only: the Google account's verified email must match the account's email, or be linked to it from account settings. It never creates a school membership; schools decide who belongs to them.
  - At school signup (6.2), Google can verify the owner's email in place of the email link.
  - Users can link and unlink Google in account settings; unlinking requires a password to be set, so nobody is locked out.
  - Every school host uses one fixed callback on the product domain, then returns to the school's host with a one-time handoff code (`domains-and-routing.md` section 5a), so subdomains and custom domains need no Google configuration.
- Session management: list active devices, log out everywhere, idle timeout set by the admin.
- Sessions are per school host. Signing in to one school never signs the user out of another. Moving between hosts (after signup, from "Find your school") uses a single-use, short-lived handoff code.
- Role-based access control:
  - Permissions use `resource:action` keys, for example `fees:collect` and `results:publish`.
  - System roles: Admin, Principal, Accountant, Teacher, Class Teacher, Receptionist, Librarian, Committee Member, Student, Guardian. The owner is not a role; the OWNER membership carries school-admin rights.
  - Custom roles can be cloned from a system role and edited.
  - Scope rules restrict a role to its own classes, sections, subjects or branch.
- One user can hold several roles; a teacher who is also a guardian switches context.
- Portal accounts: every guardian gets an account. Students get accounts only in the classes the school selects in settings (default: Class 6 and above).
- Bulk credential generation for students and guardians, with login/password slips printed per section.
- Audit log of logins, permission changes and sensitive data access.

**User stories**

- As an admin, I want to create a "Vice Principal" role with read access to everything and write access to exams so that I don't have to give full admin rights.
- As a guardian with two children in the school, I want one login that lets me switch between them.
- As a teacher, I want to log in with my phone number and an OTP so that I don't need to remember a password (Phase 1b).

**Acceptance criteria**

- Every API endpoint enforces a permission check, and a user without permission gets a 403 with no data leaked.
- A scoped teacher can only see attendance and marks for the classes and subjects assigned to them.
- After 5 failed logins the account is locked for 15 minutes, OTP sending is rate-limited, and the admin can see these events.
- A role change takes effect on the user's next request without forcing re-login.
- A session or handoff code issued for one school is rejected on every other school's host.

### 6.4 Academic structure — P0

**Purpose:** model how the school is organized for each academic session.

**Features**

- Academic sessions (years) with start and end dates and one active session. Sessions can span calendar years.
- Terms or semesters inside a session (for example, Half-yearly and Annual).
- **Classes (grades)** are permanent school records (Class 1 to Class 10, and so on) that carry over from session to session.
- **Shifts** (morning/day) are school-level settings.
- **Sections** belong to a class and a session (Class 6, Section A, 2026), and each section runs in one shift. Groups/streams (Science/Commerce/Humanities) are school-level and used by classes that need them.
- Subjects with a code, a type (compulsory/optional/4th subject/elective), theory/practical/MCQ components, full marks and pass marks per component.
- Subject groups and per-class curriculum per session, including the optional/4th-subject choice per student.
- **Staff directory** (Phase 1a): employee profile (name, contact, employee number, joining date, status), department and designation, linked to the person's school membership. Teacher assignments, staff invites and dashboards use it. Salary, payroll and leave quotas come with HR in 6.11.
- Teacher assignment: a class teacher per section and subject teachers per section and subject.
- Rooms and buildings: used for exam room allocation (P1) and the timetable (P1).
- Session rollover: copy the sections, curriculum and teacher assignments from the previous session.
- **Batch mode** (P1, for coaching centers and short courses), chosen per school in settings or at signup when the school type is "coaching":
  - A **course** (for example "SSC Physics crash course" or "Admission test prep") has subjects, a duration and a fee plan.
  - A **batch** is one running group of a course: start and end dates, weekly schedule (days and times), teacher(s), room and seat capacity. Batches can run all year round and overlap; they are not tied to the academic session.
  - A student enrolls in one or more batches at once, and can join mid-course or move between batches of the same course.
  - Fees per batch: one-time course fee, monthly fee billed from the joining date, or installments. Invoices, allocation and receipts work exactly as in 6.10.
  - Attendance, exams/tests, notices and the guardian portal work per batch, using the same flows as sections.
  - The UI uses "Course" and "Batch" labels instead of "Class" and "Section" when batch mode is on.

**User stories**

- As an admin, I want to roll the current session's structure into the new session in one click so that I don't rebuild it every year.
- As a principal, I want to assign Physics in Class 9 Science to Mr. Rahman for sections A and B.
- As a coaching-center owner, I want to open a new evening batch for an existing course, enroll 30 students and bill them monthly from the day they join.

**Acceptance criteria**

- Class names and subject codes are unique within a school. Section names are unique within a class and session.
- Rollover never moves students. Promotion is a separate flow (6.6).
- Teacher-assignment changes are effective-dated, so historical records still show who taught what.
- Batch enrollment is blocked when the batch is at capacity, unless a user with permission overrides it.
- A student who moves between batches keeps their attendance, marks and fee history from the previous batch.

### 6.5 Admissions and enquiries — P1

**Purpose:** capture and convert prospective students.

**Features**

- An enquiry CRM: source (walk-in, phone, Facebook, website), follow-up tasks, and a status pipeline (New → Contacted → Visited → Applied → Admitted / Lost).
- A public online admission form, configurable per class (custom fields and required documents), embeddable on the school website.
- Application fee payment online.
- Admission tests: schedule, seat plan, admit cards, marks entry and a merit list.
- Lottery support for classes admitted by lottery.
- Bulk SMS updates to applicants.
- Approve → convert to student in one step, with auto-generated student ID and roll number, admission invoice and guardian account creation.

**User stories**

- As an admission officer, I want to publish an online form for Class 6 with a ৳500 application fee so that applications and payments arrive digitally.
- As an admin, I want to admit the top 120 applicants from the test merit list in one action.

**Acceptance criteria**

- Applicants receive an application number by SMS and email after submission and payment.
- Converting an applicant creates the student, the guardian accounts, the enrollment and the admission invoice in one atomic operation.
- Conversion rates by source and class are shown on an admission dashboard.

### 6.6 Student information system (SIS) — P0

**Purpose:** a single source of truth for every student.

**Features**

- **Profile:**
  - Personal details in Bangla and English: name, DOB, gender, religion, blood group, nationality, birth registration number, photo.
  - Addresses: present and permanent, using Division/District/Upazila pickers.
  - Previous school.
- **Guardians:** father, mother and local guardian, with relationship, occupation, income, NID and contact. One guardian can link to several students, and one is marked as the primary contact.
- **Enrollment** per session: class, section, shift, group, roll number and optional subjects. Full history is kept.
- **Documents:** upload birth certificate, previous TC, photos, etc., with type, expiry and verification status.
- **Health:** allergies, conditions, medications, vaccination, emergency contacts; visible to authorized staff only.
- **Notes and discipline:** behavior incidents, counselling notes, and visibility rules for each.
- **Status lifecycle:** Applicant → Active → (Suspended) → Transferred / Left / Graduated / Dropped out, with reason and date. Applicant is used once admissions (6.5, P1) is live; until then students start as Active.
- **Promotion:** bulk promote by class, driven by result rules (pass/fail/conditional). Supports manual override, detention, roll re-assignment by merit, and section shuffle.
- **Transfers:** between sections or shifts. Transfers between branches come with branches in Phase 3 (5.1).
- **Certificates:** Transfer Certificate (TC), testimonial, character certificate and study certificate from configurable templates. Each has a serial number and a QR code for verification.
- **ID cards:** template designer, bulk printing with photo and QR/barcode, RFID card number binding.
- **Search and filtering:** search by name, ID, phone or guardian; filter by class, section, status, gender or religion; export to Excel/PDF.
- **Student 360 view:** one page showing the profile, attendance, results, fees, library, transport and notes.

**User stories**

- As a class teacher, I want to open a student's 360 view so that I can see attendance, dues and results before a guardian meeting.
- As an admin, I want to promote all passed Class 8 students to Class 9 with rolls re-assigned by merit.
- As a receptionist, I want to issue a TC with a verifiable QR code so that other schools can confirm it is genuine.

**Acceptance criteria**

- Student IDs are unique per school and follow a configurable pattern (for example `{YY}{CLASS}{SEQ:4}`).
- Bulk promotion previews outcomes per student before committing, and the batch can be rolled back within 24 hours.
- Scanning a certificate QR code opens a public verification page showing the minimal data: name, certificate type, issue date, and valid or revoked.
- Health and discipline notes are hidden from roles without the explicit permission.

### 6.7 Attendance and leave — P0

**Purpose:** accurate daily attendance with instant guardian alerts.

**Features**

- **Student attendance:**
  - Day-wise or period-wise, configured per school or class.
  - Statuses: Present, Absent, Late, Leave, Half-day, plus custom statuses.
  - Mobile-first marking: everyone is present by default, tap to toggle exceptions, and save takes under 30 seconds for a 50-student section.
  - Offline capture with background sync.
- **Device attendance:** RFID cards, fingerprint or face devices, or QR scan at the gate. Gate entry and exit events reach guardians in real time.
- **Absentee alerts:** automatic SMS or push to guardians at a configured time, with templates in Bangla and English.
- **Staff attendance:** manual, device-based, or mobile check-in with geofence and selfie. Late-arrival rules feed payroll.
- **Leave management:**
  - Students apply through the guardian app or portal; the class teacher approves.
  - Staff leave types are configured with yearly quotas and carry-forward, and go through a multi-level approval workflow.
- **Corrections:** an edit to submitted attendance records the original status, the new status, who changed it, when and why. The original is never overwritten silently.
- **Submission tracking:** admins and the principal see which sections have not submitted attendance yet today.
- **Holiday calendar:** public, school and religious holidays, with Bangladesh government holidays as a template. Attendance cannot be taken on holidays.
- **Reports:** daily summary, monthly register (the classic register layout), defaulters below X%, and late-comers.

**User stories**

- As a teacher, I want to mark attendance for my section on my phone in under a minute, even with poor connectivity.
- As a guardian, I want an SMS within 30 minutes of the attendance cutoff if my child is absent.
- As a principal, I want to see today's attendance percentage by class on my dashboard.

**Acceptance criteria**

- Attendance marked offline syncs automatically. Conflicts resolve as last-writer-wins, and an audit entry records any overwrite.
- Absentee SMS is never sent twice for the same student and day, and is not sent if the absence is changed to Present before the send time.
- Locking: attendance older than N days (configurable) can only be edited by roles with `attendance:edit_locked`.
- The monthly register PDF matches the standard paper register layout.

### 6.8 Timetable and scheduling — P1

**Purpose:** build and maintain class routines without clashes.

**Features**

- Period definitions per shift: start and end times, breaks, and different timings for different days (for example, a short Thursday).
- A manual drag-and-drop builder per section, with live clash detection: teacher double-booked, room double-booked, or a teacher's weekly load exceeded.
- Auto-generation (P2) from constraints: subject periods per week, teacher availability, consecutive-period rules and room types (lab).
- Teacher timetable and room timetable views.
- Substitution management: when a teacher is on leave, suggest free qualified teachers, assign substitutes and notify them.
- Publish to the student, guardian and teacher apps; export to PDF.

**Acceptance criteria**

- Publishing a timetable with an unresolved hard clash is blocked.
- A substitution assignment notifies the substitute immediately and appears in their day view.

### 6.9 Examinations and results — P0

**Purpose:** run the exam cycle, from scheduling to report cards, without spreadsheets.

**Features**

- **Grading systems (configurable):**
  - Grade scales with letter, point and mark range, e.g. the BD GPA 5.0 scale: A+ = 80–100 = 5.0, A = 70–79 = 4.0, A- = 60–69 = 3.5, B = 50–59 = 3.0, C = 40–49 = 2.0, D = 33–39 = 1.0, F = 0–32 = 0.
  - Templates for GPA 5.0, GPA 4.0, Cambridge (A*–U), percentage/division, and the madrasa scheme.
  - Rules: an F in any compulsory subject means the overall result is F; 4th-subject bonus (points above 2.0 added); minimum pass per component (CQ/MCQ/practical); grace marks.
- **Exam setup:** exam types (class test, monthly, half-yearly, annual, model test, pre-test), each with a weight in the final result. An exam is attached to classes and subjects, with full marks and pass marks per component.
- **Exam schedule (routine)**, seat plans, room allocation, invigilator duty, and admit cards with eligibility rules (for example, fees cleared) (P1).
- **Mark entry:**
  - Subject teachers enter marks per component in a grid with keyboard navigation, or import from Excel.
  - Absent and exempt are tracked.
  - Workflow: Draft → Submitted → Verified → Approved (principal) → Published. The Verified step is optional per school: when it is on, a user with `results:verify` (for example, a head of department) verifies before approval; when it is off, submitted marks go straight to approval.
- **Tabulation:**
  - Automatic calculation of totals, grade points, GPA, combined GPA, positions/merit (with configurable tie-breakers) and failed-subject counts.
  - Combined results across the exams of a session use the exam weights, for example 30% half-yearly + 70% annual. "CGPA" in this document means this combined session GPA, not a university-style cumulative GPA across years.
- **Report cards:**
  - Phase 1a: one or two fixed layouts with options for logo, signatures, Bangla or English, remarks, attendance summary and co-curricular grades.
  - Template designer for custom layouts (P1).
  - Bulk PDF generation by section; publish to the portal or app.
- **Merit lists, tabulation sheets, failed lists and subject-wise analysis.**
- **Continuous assessment and co-curricular / behavioral grading** (P1).
- **Board exam support** (P1): registration and form-fill data export for SSC/HSC/JSC equivalents in the board-required formats.
- **Online exams / quizzes** (see 6.12).

**User stories**

- As a subject teacher, I want to enter CQ and MCQ marks for my section and see the grade computed instantly.
- As a principal, I want to approve results for a whole class and publish them to guardians with one click.
- As a guardian, I want to view and download my child's report card on my phone the moment it's published.

**Acceptance criteria**

- GPA calculation matches the published BD board rules on a regression suite of known cases (4th-subject bonus, F in a compulsory subject, component pass).
- Marks cannot be edited after approval unless a principal re-opens them, and every change is audited with the old and new value.
- Bulk report-card generation for 500 students completes in under 2 minutes.
- Publishing sends a notification to guardians with a link to the result: in-app and email in Phase 1a, plus push and SMS from Phase 1b.

### 6.10 Fees and finance — P0

**Purpose:** maximize fee collection and give owners real-time financial visibility.

**Features**

- **Fee heads:** tuition, admission, session, exam, transport, hostel, lab, library, ID card, etc. Each head is recurring (monthly, quarterly, yearly) or one-time.
- **Fee structures:** amounts per class, group or shift for a session, with effective dates.
- **Discounts and waivers:** sibling discount, merit scholarship, staff-child discount, freedom-fighter quota, or a custom percentage or fixed amount per student. Waivers go through an approval workflow.
- **Invoice generation:** automatic monthly invoices for every active student, plus ad-hoc invoices (fines, events).
- **Late fines:** fixed or per-day rules with a grace period.
- **Collection channels:**
  - Counter collection: cash, cheque, card, bank deposit slip. Thermal or A4 receipts are printed, and partial payments are allowed.
  - Online collection by guardians through bKash, Nagad, Rocket or SSLCommerz (cards and internet banking). Payment is auto-reconciled via webhook.
  - Bank collection: a unique reference per invoice for partner-bank collection, with statement import for reconciliation.
- **Payment allocation:** invoices, payments and allocations are separate records. A payment is allocated to one or more invoice lines (oldest due first by default, or chosen by the accountant), so one payment can settle several months or several children, and a partial payment leaves a precise remainder.
- **Reconciliation:** each online or bank payment carries the provider's transaction reference and a reconciliation status (pending, matched, mismatched). A reconciliation screen lists mismatches between gateway or bank statements and recorded payments.
- **Receipts:** a sequential receipt number, with an in-app/email confirmation to the guardian (plus SMS from Phase 1b).
- **Dues:** a due list by class, aging buckets, and automated reminders on a configurable schedule. Admit cards and results can optionally be blocked until dues are cleared.
- **Refunds and adjustments** go through an approval workflow and keep an audit trail.
- **Income and expense ledger:** expense categories, vouchers with attachments, and petty cash. Cash book, bank book, and daily collection report per collector.
- **Financial reports:** collection vs. demand, head-wise collection, discount report, defaulters, income vs. expense, monthly P&L. Export to Excel and to accounting software (Tally, QuickBooks CSV).

**User stories**

- As an accountant, I want monthly tuition invoices generated automatically on the 1st with the sibling discount applied.
- As a guardian, I want to pay all dues for both my children in one bKash payment and get receipts instantly.
- As an owner, I want today's collection by channel on my phone at 5 pm.

**Acceptance criteria**

- An online payment marks the invoice paid within 60 seconds of gateway confirmation. Duplicate webhook calls are idempotent.
- Receipt numbers are gap-free and never reused. Cancelling a receipt requires a reason and permission, and the cancelled receipt stays visible.
- Each collector's daily cash report reconciles to the receipts they issued.
- Collection vs. demand totals always reconcile: total billed − discounts − collected = outstanding.
- An invoice's outstanding balance always equals its total minus the sum of its allocations; an allocation can never exceed the payment's unallocated amount or the line's remaining balance.
- Completed payments are never deleted or edited in place. Corrections are made through a reversal or refund record, so the original transaction stays visible.
- Only a verified gateway webhook or a server-side status check can mark an online payment successful; a browser redirect alone never does.

### 6.11 HR and payroll — P1

**Purpose:** manage staff records and run payroll accurately.

The basic staff directory (profile, department, designation) is already in the MVP (6.4). This module extends it.

**Features**

- **Employee profiles:** extended personal details, NID, education, experience, department, designation, employment type (permanent/contract/part-time), joining date, bank account and MFS account, documents.
- **Recruitment** (P2): job posts, applications, interviews, offer letters, onboarding checklist.
- **Staff attendance and leave:** see 6.7.
- **Salary structures:** basic pay plus allowances (house rent, medical, conveyance) and deductions (PF, tax, advance recovery, absence/late deductions).
- **Monthly payroll run:** Generate → Review → Approve → Disburse. Pay goes out as a bank advice file or MFS bulk payment; payslips are emailed or appear in the app.
- **Increments, bonuses** (Eid / festival), arrears.
- **Provident fund and loan/advance tracking.**
- **Performance appraisals** (P2) with configurable criteria.
- **Teacher workload report.**
- **Duty roster:** configurable duty types (gate, assembly, tiffin break, exam invigilation, event, night duty in the hostel) with weekly or date-based rosters per staff member. Rosters can be copied from the previous week, are published to the staff app, and send a reminder before each duty.
- **Task assignment:** assign a task to one or more staff members, with a description, attachments, due date, priority and status (Open → In progress → Done). Comments and a notification on assignment, before the due date and when it is overdue.

**Acceptance criteria**

- A duty cannot be assigned to someone on approved leave or already on another duty at the same time; the roster shows the clash.
- Staff see their own duties and tasks for the day on their dashboard.
- A payroll run is reproducible: rerunning it with the same inputs gives identical results. An approved run is locked.
- Absence and late deductions are pulled from attendance automatically, and HR can override them with a reason.
- Payslips are generated as PDF and are visible only to the employee and HR/accountants.

### 6.12 Learning management (LMS) — P1

**Purpose:** extend learning beyond the classroom, especially for homework and remote learning.

**Features**

- **Homework and assignments:**
  - Teachers post them per section and subject, with attachments, a due date and max marks.
  - Students submit text, files or photos of handwritten work.
  - Teachers grade and give feedback.
- **Class diary / lesson plan:** daily topics covered, visible to guardians.
- **Study materials:** files, links and videos organized by subject and chapter.
- **Recorded lessons:** teachers add a recorded lesson as a link (YouTube unlisted, Google Drive or another video host). The platform shows it embedded and tracks who opened it. It does not host or stream video files itself.
- **Online quizzes and exams:** MCQ, true/false, short answer; question bank with tags and difficulty; timer, shuffle, auto-grading; results can optionally feed exam marks.
- **Live classes:** schedule Zoom/Meet/Jitsi links, with attendance captured from joins.
- **Syllabus tracking:** chapter completion percentage per subject and section.

**Acceptance criteria**

- Students and guardians get a notification when homework is posted and a reminder 24 hours before it's due.
- Quiz auto-grading is correct for objective questions, and submissions after the timer ends are rejected.
- Uploads are limited by plan storage and size per file, and images are compressed client-side.

### 6.13 Communication and notifications — P0

**Purpose:** reliable, targeted communication with every stakeholder.

**Phasing:** Phase 1a has the notice board, in-app notifications, email, templates and the communication log. Phase 1b adds SMS with the wallet, web push, automated triggers and emergency broadcast. Two-way messaging and parent-teacher meetings are P1 (Phase 2).

**Features**

- **Notice board:** notices with attachments, targeted at everyone, a role, a class, a section, a group or individuals. Can be scheduled, pinned and set to expire, with read receipts.
- **Channels:** in-app, push (mobile and web), SMS, email, and WhatsApp Business (P1). Channel preference and fallback rules (push → SMS).
- **SMS:**
  - Masking (sender ID) and non-masking.
  - Bangla Unicode support with a character and part counter.
  - Prepaid credit wallet with low-balance alerts and a delivery report.
- **Templates:** for absent, fee due, payment received, result published, birthday, holiday, etc. Variables like `{student_name}` are supported, in Bangla and English.
- **Automated triggers:** the events above fire notifications automatically according to school settings.
- **Two-way messaging** (P1): guardian ↔ teacher and class-teacher chats, with an admin-configurable allowed window (for example 8 am – 8 pm). Moderated, no student-to-student chat.
- **Parent-teacher meetings** (P1): slot booking, reminders, notes.
- **Emergency broadcast:** priority SMS plus push to all guardians in one step.
- **Communication log:** what was sent to whom, when, through which channel, and its delivery status.

**Acceptance criteria**

- Bulk SMS to 2,000 recipients is queued in under 5 seconds and delivered asynchronously with per-recipient status.
- The wallet is checked before a send. A send that exceeds the balance is blocked with a clear message, except emergency broadcasts, which can overdraw up to a configured limit.
- Messages outside the allowed window are queued and delivered when it opens (P1, with two-way messaging).

### 6.14 Student and guardian portal and mobile apps — P0 (web/PWA), P1 (native)

**Purpose:** give students and guardians self-service access on any device.

**Features**

- A guardian dashboard per child: today's attendance, upcoming exams, dues, latest notices, homework.
- Pay fees online, download receipts and see payment history.
- View and download results and report cards; see a performance trend chart.
- Apply for leave. Messaging teachers and booking PTM slots arrive in Phase 2 (6.13).
- Timetable, homework, study materials, quizzes (student).
- Transport live location and pick-up/drop alerts (when transport is enabled).
- Library: borrowed books and due dates.
- Child switcher for guardians with several children. Children at the same school switch in place. Children at other schools are listed as links that move the guardian to that school's host with a one-time handoff code (sessions are per school host, 6.3).
- Student portal accounts exist only for the classes the school enables (6.3); in other classes the guardian account covers the student.
- **Native apps** (Android first, then iOS):
  - Separate experiences for Guardian/Student and Teacher/Staff.
  - Push notifications, offline caching, biometric unlock.
  - School branding (logo, colors).
  - White-label apps as a Premium add-on.
- **Teacher app:** attendance, marks entry, homework, messaging, timetable, leave, payslips.

**Acceptance criteria**

- The portal works on 3G connections: first meaningful paint in under 3 s on a mid-range Android device.
- Guardians can only see data for students linked to them.
- The app supports Bangla and English, switchable at runtime.

### 6.15 Library — P1

- Catalog: title, author, publisher, ISBN (lookup by ISBN), category, rack location, copies with accession numbers and barcodes.
- Issue and return by barcode scan, with configurable limits and durations per member type (student or staff).
- Reservations and due-date reminders.
- Overdue fines added automatically to the student's fee invoice.
- Lost or damaged book handling.
- Reports: most-borrowed, overdue list, stock verification.
- Digital library: e-books and PDFs with access by class (P2).

**Acceptance criteria:** an issue is blocked when the member is at their limit or has overdue items (an override needs permission). The fine is calculated exactly per the rules on return.

### 6.16 Transport — P1

- Vehicles: registration, capacity, fitness and insurance expiry reminders. Drivers and helpers.
- Routes and stops with pickup and drop times; route fare by stop or zone.
- Student allocation to a route and stop, with seat capacity checks. Transport fees go onto the invoice automatically.
- GPS tracking (P2) through a device integration or the driver app; live map for guardians; "bus approaching" alerts.
- Pick-up and drop confirmation (driver app or RFID on the bus), with a guardian notification.
- Trip logs, fuel and maintenance records.

**Acceptance criteria:** allocation cannot exceed vehicle capacity. Guardians see only their child's bus location, and only during trip hours.

### 6.17 Hostel — P2

- Hostels, floors, rooms and beds, with type and fee.
- Allocation and transfer; hostel fee goes onto the invoice.
- Hostel attendance (night roll call), leave and outpass with guardian approval and notification.
- Mess management: menus, meal attendance, meal charges.
- Visitor log with approved-visitor lists.
- Warden incident notes.

**Acceptance criteria:** a bed cannot be double-allocated. An outpass requires guardian confirmation before the gate logs exit.

### 6.18 Inventory and assets — P2

- Item catalog, categories, units, stores/locations.
- Suppliers, purchase requisitions → purchase orders → goods receipt.
- Stock issue to departments or staff, and sale to students (uniforms, books) with billing.
- Stock levels, reorder alerts, stock audit.
- Fixed assets register: tagging (QR), assignment, depreciation, maintenance schedules, disposal.

### 6.19 Events, calendar and co-curricular activities — P1

- School calendar: holidays, exams, events, PTMs. Synced to the apps and exportable (iCal).
- Event management: description, audience, registration, fee, attendance, photo gallery.
- Clubs, houses and sports teams: members, activities, achievements.
- Certificate and award generation from templates, with QR verification.

### 6.20 Alumni — P2

- Graduates convert to alumni automatically, with opt-in profile updates.
- Directory with privacy controls; batch pages.
- Events, newsletters, and donation campaigns with online payment.
- Alumni certificate and document requests.

### 6.21 Front office — P1

- Visitor log: name, phone, purpose, person to meet, in/out time, optional photo; visitor slip printing.
- Call log, postal dispatch and receive register.
- Complaint and grievance tracking with assignment and status.
- Gate pass for early student pickup, verified against authorized guardians, with a guardian notification.

### 6.22 Reports and analytics — P0 (standard reports), P1 (dashboards and builder)

- **Role dashboards:**
  - Owner/admin: enrollment, attendance today, collection today and month-to-date, dues, staff present, upcoming events.
  - Teacher: today's classes, pending attendance and marks, homework to grade.
  - Accountant: collection, dues and expenses.
- **Standard report library:** around 60 reports across modules over time, with filters and export to PDF and Excel. Exports run in the background for large data sets. The Phase 1a set:
  - Attendance: daily summary, monthly register, defaulters below X%.
  - Fees: due list with aging, collection vs. demand, daily collection per collector, head-wise collection.
  - Exams: result sheet, merit list, tabulation sheet, failed list.
  - Students: class/section lists with filters.
- **Custom report builder** (P1): pick an entity, columns, filters and grouping; save and share with roles; schedule an email delivery.
- **Multi-branch analytics** (P2): compare branches on enrollment, collection, attendance and results.
- **Government and compliance reports:** BANBEIS annual survey data and EMIS exports in the required formats.

**Acceptance criteria:** dashboards load in under 2 s for schools with up to 5,000 students. Report numbers always match the source module totals.

### 6.23 AI features — P2

- **At-risk student detection:** flag students with falling attendance, declining marks or fee defaults; suggest interventions to the class teacher.
- **Report-card remark generator:** draft personalized remarks in Bangla or English from performance data. A teacher reviews them before publishing.
- **Question generator:** draft MCQs from a chapter or uploaded material for the question bank.
- **Admin assistant:** natural-language questions over the school's own data ("How many Class 9 students owe more than ৳5,000?"), respecting the asker's permissions.
- **FAQ chatbot** for guardians (fees, timings, holidays), grounded in school notices and settings.
- **Smart insights** on dashboards: anomalies in collection and attendance.

**Guardrails:**

- AI never takes an action automatically; a human always confirms.
- Responses are restricted to the tenant's data and the user's permissions.
- No student data is used to train third-party models.
- Every AI output is labeled as AI-generated.

### 6.24 Settings and customization — P0

- School profile, branding (logo, colors), the letterhead used on all PDFs.
- Localization: language, date format, Bangla or English numerals, currency, time zone, weekend days.
- Numbering patterns: student ID, roll, receipt, invoice, certificate serials.
- Custom fields on student, guardian, employee and admission entities: text, number, date, select or file. These appear on forms, filters and exports (P1).
- Document and print template editors: report card, ID card, certificates, receipts, admit card (P1). Phase 1a uses fixed layouts with options (logo, letterhead, language, signatures).
- Portal accounts: the classes whose students get their own login (6.3).
- Results workflow: whether the Verified step is required (6.9).
- Notification preferences and SMS sender ID.
- Custom domain (Standard+): add an app host, see the CNAME and TXT records to create, track verification and certificate status, set it as primary, or remove it.
- School address: change the slug (rate-limited; the old address redirects for 12 months).
- Public school home page: what appears on `/` (profile, contact, public notices) and whether the school is listed in the directory.
- Data export: a full export of the school's data at any time (CSV in Phase 1a; Excel plus a files archive later).
- Audit log viewer for admins.

---

### 6.25 Managing committee / governing body — P1 (role in Phase 1a)

**Purpose:** support the School Managing Committee (SMC) or Governing Body that most non-government schools, colleges and madrasas in Bangladesh must have, and the board of trustees of private and English-medium schools.

**Features**

- **Committee member access (Phase 1a):** the Committee Member system role (4.4) gives read-only dashboards and reports, so members can follow finance, enrollment, attendance and results without admin rights. Schools can clone and adjust it like any role.
- **Committees and terms:** one or more committees per school (type: managing committee, governing body, board of trustees, or custom), each with terms that have a start date, an end date and an approval reference (for example, the education board's approval letter as an attachment). Past terms and their members are kept.
- **Members:** name, designation (president/chairman, vice-president, member secretary, guardian representative, teacher representative, founder/donor member, board nominee, or custom), category, contact, photo, joining and leaving dates within the term. A member can be linked to a user account; their Committee Member role then follows the term and ends automatically when the term or their membership ends.
- **Meetings:** schedule with agenda and attachments, invitations and reminders to members (email/in-app; SMS from Phase 1b), attendance and quorum check, minutes.
- **Resolutions:** numbered per committee and term, with text, decision date, attachments and follow-up actions assigned to staff, with status. Resolutions are searchable and can be linked from the records they authorize (for example, an expense or a fee change).
- **Committee approvals** (P2): optionally require committee approval for configured actions such as large expenses, fee-structure changes or waivers above a limit, recorded as a resolution.

**User stories**

- As a committee president, I want to see this month's collection, dues and expenses on my phone before the monthly meeting.
- As the member secretary (head teacher), I want to send the agenda to all members and record the minutes and resolutions after the meeting.
- As an admin, I want a member's access to end automatically when the committee's term ends.

**Acceptance criteria**

- A Committee Member can never change data and never sees individual students' health, discipline or guardian details.
- Resolution numbers are unique and sequential within a committee term and never reused.
- When a term ends, its members lose the Committee Member role on the next request; the term's records stay readable for admins.
- Every change to committee membership is in the audit log.

---

## 7. Core user workflows

These end-to-end flows cut across modules. They drive screen design, API design and the end-to-end test suite (11.3).

### 7.1 Onboard a school

1. On the product domain, the owner signs up with the school name, type, email, phone and slug, and verifies by email link (plus an SMS OTP from Phase 1b).
2. The platform provisions the organization in one transaction: default roles, settings and the owner's admin membership.
3. The owner is moved to `<slug>.<product-domain>` already signed in and works through the setup wizard (6.2): profile, session, shifts, classes, sections, subjects, grading, fee heads.
4. The owner adds staff to the staff directory and invites them. Staff activate their accounts from the invite link on the school's host.
5. The admin uploads students and guardians from the Excel template, reviews the row-level validation preview, and confirms.
6. The setup checklist reaches 100% and the school is ready for daily operations.

### 7.2 Record daily attendance

1. A teacher opens the app and picks one of their assigned sections for today.
2. The roster loads with everyone marked Present; the teacher taps the exceptions and saves.
3. If offline, the submission is queued and synced when the device reconnects.
4. At the configured cutoff, absentee alerts are queued for guardians (once per student per day).
5. The principal's dashboard shows today's percentage by class and any sections that have not submitted.
6. Later edits go through the correction flow (6.7), keeping the original value in the audit trail.

### 7.3 Bill and collect fees

1. The accountant sets up fee heads, the fee structure for the session, and discounts.
2. On the billing day, invoices are generated for every active student, with discounts applied.
3. The guardian pays online, or pays at the counter where the accountant records it.
4. An online payment is confirmed only by a verified gateway webhook or server-side check.
5. The payment is allocated to invoice lines, a gap-free receipt is issued, and the outstanding balance updates.
6. The guardian receives an in-app or email confirmation (SMS or push from Phase 1b).
7. The accountant reconciles the day's collection per collector and per channel, and resolves any mismatches.

### 7.4 Publish exam results

1. The principal or an admin creates the exam, attaches classes and subjects, and sets components, full marks and pass marks.
2. Subject teachers enter marks per component; the grade is computed as they type.
3. Marks move through Draft → Submitted → (Verified, when the school requires it) → Approved; approved marks are locked.
4. Tabulation computes totals, GPA, positions and failed subjects using the school's grading rules.
5. The principal publishes the results; guardians and students are notified, and report cards become available.
6. Any later change requires the principal to re-open the marks, and the old and new values are audited.

### 7.5 Admit a student (Phase 2)

1. A guardian submits the online admission form and pays the application fee.
2. The admission officer reviews the application and documents, and records test marks.
3. The merit list is generated, and offers go out by SMS and email.
4. On approval, one atomic operation creates the student, the guardian accounts, the enrollment and the admission invoice.

---

## 8. Non-functional requirements

### 8.1 Security

- **Tenant isolation** is enforced in two independent layers: application-level scoping and database row-level security. Automated cross-tenant leakage tests run in CI.
- Data is encrypted with TLS 1.2+ in transit and AES-256 at rest. Sensitive fields (NID, health data, bank accounts) are additionally encrypted at the field level.
- Passwords are hashed with Argon2/bcrypt. OTPs are short-lived and rate-limited. JWT access tokens are short-lived, with rotating refresh tokens.
- OWASP ASVS Level 2 controls apply: input validation, output encoding, CSRF protection, secure headers, and file-upload scanning and type checks.
- Every endpoint is protected by RBAC, deny by default.
- Session cookies are host-only, so no cookie is shared between schools or with the product domain. Browsers reach the API through the same host they are on, so custom domains need no CORS entries.
- A custom domain is served only after DNS ownership verification (TXT record), and TLS certificates are issued only for verified domains.
- Rate limiting is applied per tenant, per user and per IP.
- An immutable audit log records authentication events, permission changes, financial transactions, mark changes and data exports. It is kept for 7 years.
- Penetration testing runs before GA and annually after that. A responsible-disclosure policy is published.

### 8.2 Privacy and compliance

- Compliance with Bangladesh's data-protection law (Personal Data Protection) and the Digital Security/Cyber Security Act.
- The design is GDPR-ready for international expansion: consent records, right of access and export, and right to erasure, subject to legal retention.
- **Children's data:** collection is minimized, guardian consent is recorded for photos and media, and student data is never used for advertising.
- Each school is the data controller and the platform is the data processor; a DPA template is provided.
- Data residency: a primary region is selectable when needed (for example, a Bangladesh or Singapore region).
- Retention policies are configurable, and deletion is certified on termination.

### 8.3 Performance and scalability

| Metric                                         | Target                        |
| ---------------------------------------------- | ----------------------------- |
| API p95 latency (read)                         | < 300 ms                      |
| API p95 latency (write)                        | < 500 ms                      |
| Web first contentful paint (3G, mid-range Android) | < 3 s                     |
| Attendance save (50 students)                  | < 1 s                         |
| Concurrent users at morning peak (8–9 am)      | 50,000 platform-wide          |
| Schools supported on shared infrastructure     | 10,000+                       |
| Largest single school                          | 15,000 students               |
| Bulk operations (invoices, report cards, SMS)  | Run asynchronously in queues (BullMQ on Redis) with progress shown |

### 8.4 Availability and disaster recovery

- 99.9% monthly uptime SLA (Premium: 99.95%).
- Zero-downtime deployments; scheduled maintenance windows announced 72 hours ahead, outside school hours.
- Automated backups with point-in-time recovery: **RPO ≤ 15 minutes, RTO ≤ 4 hours**. Backups go to a second region and are restored in a monthly test.
- A public status page and incident communications.

### 8.5 Usability and accessibility

- WCAG 2.1 AA compliance.
- Every core task can be completed by a new teacher without training, which is validated with usability tests.
- Consistent design system with light and dark themes.
- Keyboard-friendly data-entry grids for marks and attendance.
- Printable outputs on A4, Legal and thermal (80 mm) paper.

### 8.6 Internationalization and localization

- Full Bangla and English UI; the architecture also supports adding Arabic (RTL), Hindi and others.
- Bangla numerals, BDT formatting (৳1,00,000 using lakh grouping), and the Asia/Dhaka time zone, all of which can be changed per tenant.
- Gregorian calendar by default, with optional Bangla (Bangabda) and Hijri date display.
- Names are stored in both Bangla and English. Search works in both and supports phonetic matching.
- Region-specific defaults, such as the grading template, holidays and payment gateways, live in configuration packs. That is what makes the product global-ready.

### 8.7 Reliability and offline

- PWA with an offline shell; attendance and marks entry can be queued offline and synced when the device reconnects.
- Idempotent APIs for payments and bulk operations.
- Graceful degradation when an external provider (SMS, payment) is down: requests are queued with retry and a fallback provider.

### 8.8 Observability and operations

- Structured logs carrying the tenant and request ID, distributed tracing, and metrics dashboards.
- Error tracking with alerting; uptime monitors per critical flow (login, payment webhook, SMS send).
- Usage analytics per tenant for product decisions, privacy-respecting and with no PII in analytics.
- Feature flags for gradual rollouts.

### 8.9 Maintainability

- An API-first design. Every UI capability is backed by a documented REST API with OpenAPI specs.
- Automated tests: unit, integration, end-to-end for critical flows, and the GPA/fee calculation regression suites.
- CI/CD with staging and production environments, and database migrations that never break the running version.
- Technical choices: the backend stays on NestJS 11 with TypeORM and PostgreSQL. Background jobs and notifications run on BullMQ (Redis). PDFs (report cards, receipts, registers) are rendered from HTML with headless Chromium, which shapes Bangla text correctly. Files go to S3-compatible object storage (MinIO in local development) and are served through short-lived signed URLs.

---

## 9. Integrations

| Category            | Providers / standards                                                         | Priority |
| ------------------- | ----------------------------------------------------------------------------- | -------- |
| Payment gateways    | bKash (tokenized checkout), Nagad, Rocket, SSLCommerz, aamarPay; Stripe for international | P0 (bKash, SSLCommerz), P1 others |
| SMS gateways        | BD providers (e.g. SSL Wireless, BulkSMSBD, Alpha SMS), Twilio for international; masking and non-masking | P0 |
| Email               | SMTP / transactional email provider (SES, SendGrid, Postmark)                   | P0       |
| Push notifications  | Firebase Cloud Messaging, Web Push                                            | P0 (web), P1 (mobile) |
| WhatsApp            | WhatsApp Business Platform (template messages)                                | P1       |
| Attendance devices  | ZKTeco and similar biometric/RFID devices via SDK or push API; QR scanning      | P1       |
| GPS                 | Standard GPS trackers (GT06 protocol) or the driver mobile app                    | P2       |
| Video classes       | Zoom, Google Meet, Jitsi (link generation, attendance import)                  | P1       |
| Sign-in             | Google (OpenID Connect), including Google Workspace for Education accounts      | P0       |
| Accounting          | Excel/CSV exports, Tally, QuickBooks formats                                    | P1       |
| Government / boards | Education board registration exports, BANBEIS/EMIS data formats                | P1       |
| File storage        | S3-compatible object storage with a CDN (MinIO locally), signed URLs           | P0       |
| PDF rendering       | HTML templates rendered by headless Chromium                                   | P0       |
| Public API          | REST API with API keys per school, webhooks for key events (student admitted, payment received, result published) | P2 |

---

## 10. Core data entities

This is a conceptual model only. The detailed schema will be designed separately.

| Domain          | Key entities                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------ |
| Platform        | Organization (school), Organization domain, Slug history, Branch group, Group template, Plan, Subscription, Platform invoice, Feature flag, Platform user |
| Identity        | User (global account; email and/or phone), Membership (user ↔ school), Role, Permission, Session, Audit log            |
| Academic        | Academic session, Term, Shift, Class (permanent), Section (per class and session), Group, Subject, Curriculum, Employee (staff directory), Department, Designation, Teacher assignment, Room, Period, Timetable entry, Course, Batch, Batch enrollment |
| Students        | Student, Guardian, Student–guardian link, Enrollment, Document, Health record, Note, Promotion, Certificate |
| Admissions      | Enquiry, Admission form, Application, Admission test, Merit list                                  |
| Attendance      | Attendance record (student/staff), Attendance correction, Device event, Leave type, Leave request, Holiday               |
| Exams           | Grade scale, Exam, Exam schedule, Mark (per component), Result, Report-card template               |
| Finance         | Fee head, Fee structure, Discount/waiver, Invoice, Invoice line, Payment, Payment allocation, Receipt, Refund/reversal, Reconciliation, Expense, Ledger entry |
| HR              | Salary structure, Payroll run, Payslip, Loan/advance, Duty type, Duty roster entry, Task |
| LMS             | Homework, Submission, Study material, Question bank, Quiz, Quiz attempt, Lesson plan              |
| Communication   | Notice, Message thread, Message, Notification, Template, SMS wallet, Delivery log                 |
| Campus services | Book, Copy, Issue; Vehicle, Route, Stop, Transport allocation; Hostel, Room, Bed, Hostel allocation; Item, Stock movement, Asset |
| Engagement      | Event, Club, Achievement, Alumni profile, Donation                                                |
| Governance      | Committee, Committee term, Committee member, Meeting, Meeting attendance, Resolution              |

Every school-owned entity carries the organization ID, and its uniqueness constraints are scoped per organization.

---

## 11. Testing and release criteria

### 11.1 Unit tests

- Permission evaluation, including scope rules (own classes, sections, subjects).
- Tenant scope resolution (header, subdomain, custom domain, inactive domain, renamed slug, reserved slug).
- Grade, GPA and tabulation rules: the BD GPA regression suite (4th-subject bonus, F in a compulsory subject, component pass, grace marks), and one suite per grading template.
- Fee calculations: discounts, late fines, invoice generation, payment allocation, outstanding balances.
- Attendance summaries and percentages.
- Plan entitlement and limit checks.
- Numbering patterns (student ID, receipt, invoice).

### 11.2 Integration tests

- Organization provisioning (org, system roles and owner membership in one transaction).
- Database constraints, per-org uniqueness and RLS policies.
- Student import, enrollment and promotion (including rollback).
- Attendance submission, correction and duplicate-alert suppression.
- Marks workflow through publication, and re-open with audit.
- Invoice generation, payment confirmation, allocation and reconciliation.
- Idempotent gateway webhooks.
- Notification queueing and retry.
- File access permissions and signed URLs.

### 11.3 End-to-end tests

The core workflows in section 7: onboarding a school, inviting staff, importing students, recording attendance, billing and collecting fees, publishing results, and a guardian seeing only their linked children.

### 11.4 Security tests

- Cross-tenant access attempts: changing IDs in URLs and bodies, a forged `x-tenant-id` header, and a token from another school.
- Platform tokens on school APIs and school tokens on platform APIs.
- Role escalation and permission bypass.
- Insecure direct object references on students, invoices, documents and exports.
- Gateway webhook forgery and replay.
- Session expiry and revocation.
- A session or handoff code from one school replayed on another school's host, reused, or used after expiry.
- Claiming a custom domain without the TXT record, and requesting a certificate for an unverified host.
- Account enumeration through "Find your school", signup and password reset.
- Malicious file uploads.
- Abuse of bulk actions, OTP sending and rate-limited endpoints.

These run in CI on every change that touches tenancy, auth, RBAC or finance.

### 11.5 Release criteria (every production release)

- No open critical security issues.
- Tenant isolation, GPA and fee regression suites pass at 100%.
- End-to-end tests for the core workflows pass.
- Database migrations are tested against a copy of production data, and a backup restore has been tested.
- Monitoring and error alerting are active.

---

## 12. Release roadmap

| Phase | Theme | Scope | Target |
| ----- | ----- | ----- | ------ |
| **Phase 1a: Pilot MVP** | Run the school day | Platform admin for the super-admin only, with manual plan assignment, limits and trial extension (6.1); onboarding wizard with email verification (6.2); auth with email/phone + password, Google sign-in and RBAC, including the Committee Member role (6.3, 6.25); academic structure with the staff directory (6.4); SIS with Excel import (6.6); attendance & student leave (6.7, online only); exams & results core cycle with BD GPA and fixed report-card layouts (6.9); fees with counter collection, allocation, receipts and dues (6.10); notices, in-app notifications and email (6.13); guardian/student web portal (6.14); the Phase 1a reports & dashboards (6.22); essential settings (6.24) | Pilot with 3–5 schools |
| **Phase 1b: GA** | Get paid and reach guardians | Online fee payment via SSLCommerz and bKash with reconciliation (6.10), SMS with wallet, absentee alerts, automated triggers and emergency broadcast (6.13), SMS OTP for signup, activation and passwordless login (6.2, 6.3), web push, offline attendance sync (6.7), installable PWA, self-serve subscription billing and plan upgrades, platform roles and consent-based impersonation (6.1), staff attendance and leave (6.7) | Pilot with 10 schools, then GA |
| **Phase 2** | Go deeper and mobile | Exam routine, seat plans, admit cards, invigilators and the report-card designer (6.9), board exam exports (6.9), admissions CRM (6.5), timetable builder (6.8), HR & payroll with duty roster and tasks (6.11), batch mode for coaching centers (6.4), LMS (6.12), two-way messaging and PTM (6.13), custom fields and template editors (6.24), native Android apps (guardian/student and teacher), WhatsApp, library (6.15), transport without GPS (6.16), events & certificates (6.19), front office (6.21), managing committee module (6.25), custom report builder, device attendance | GA + 6 months |
| **Phase 3** | Scale and intelligence | Hostel (6.17), inventory & assets (6.18), alumni (6.20), GPS live tracking, timetable auto-generation, branches and school groups: parent organizations, branch switching, transfers between branches, multi-branch analytics and group templates (5.1), AI features (6.23), iOS apps, white-label apps, public API & webhooks, international configuration packs | GA + 12 months |

### 12.1 Out of scope for the MVP (Phases 1a and 1b)

These are deliberately excluded so the MVP stays shippable. Requests for them go on the Phase 2/3 backlog.

- HR and payroll beyond the basic staff directory, LMS, library, transport, hostel, inventory, alumni, front office.
- Admissions CRM and online admission forms (students are entered manually or imported).
- Batch mode for coaching centers (6.4); coaching centers are onboarded from Phase 2.
- Timetable builder (a static timetable can be uploaded as a file or notice).
- Native mobile apps (the PWA covers mobile).
- Device attendance (RFID, biometric, QR gates) and GPS tracking.
- WhatsApp, Nagad, Rocket and aamarPay.
- Board registration and BANBEIS/EMIS exports.
- Custom report builder, branches and multi-branch analytics.
- Exam routine, seat plans, admit cards and the report-card designer.
- Two-way messaging and parent-teacher meetings.
- The managing committee module (meetings, minutes, resolutions); only the Committee Member role is in the MVP.
- Custom fields and print-template editors.
- AI features.
- Hosting the school's own website on its apex domain (a page builder or CMS). Custom domains cover the app host only.
- Full double-entry accounting and statutory financial statements.

### 12.2 Indicative timeline

These are estimates for one experienced full-stack developer, assuming the tenancy foundation that is already built. Imports, grading edge cases, PDF layouts and payment-gateway onboarding are the biggest sources of uncertainty.

| Step | Estimate | Deliverable |
| ---- | -------- | ----------- |
| Foundation hardening | 2–3 weeks | Org provisioning, auth (incl. Google sign-in), RBAC and scope rules, audit log, CI with tenant-isolation tests |
| Academic structure and SIS | 3–4 weeks | Sessions, shifts, classes, per-session sections, subjects, staff directory, teacher assignments, students, guardians, enrollment, Excel import |
| Attendance | 2 weeks | Mobile marking, corrections, holidays, reports |
| Exams and results | 3 weeks | Grading engine with BD GPA suite, mark entry workflow, tabulation, fixed-layout report-card PDFs |
| Fees | 3 weeks | Fee heads and structures, invoices, counter collection, allocation, receipts, dues |
| Portal, notices and dashboards | 2–3 weeks | Guardian/student portal, notices, email, role dashboards, standard reports |
| Pilot hardening (end of 1a) | 2 weeks | Bangla localization, security review, backups, pilot onboarding |
| Phase 1b | 6–8 weeks | Online payments and reconciliation, SMS and wallet, web push, offline sync, subscription billing |

Phase 1a totals roughly 17–20 weeks, and Phase 1b roughly another 6–8 weeks.

### 12.3 MVP exit criteria

- 10 pilot schools run daily attendance, one full exam cycle and one month of fee collection on the platform.
- No P0/P1 bugs open, and the security review and penetration test findings are resolved.
- GPA and fee calculation regression suites pass at 100%.
- Bangla localization is complete for every MVP screen, PDF and SMS template.

---

## 13. Risks, assumptions and open questions

### 13.1 Risks

| Risk                                                             | Impact | Mitigation                                                                           |
| ---------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------ |
| Low digital literacy among staff and guardians                   | High   | Bangla-first UX, video tutorials, onboarding calls, "present by default" attendance  |
| Unreliable connectivity in rural areas                           | High   | PWA offline mode, lightweight pages, SMS fallback                                    |
| Grading rules vary by board, school and year                     | High   | Configurable grade engine, templates, a regression suite per template                |
| Payment gateway onboarding delays (merchant accounts per school) | Medium | Aggregator model through SSLCommerz first, plus a guided per-school MFS merchant setup |
| SMS cost and deliverability                                      | Medium | Multiple providers with failover, prefer push where it's available, wallet transparency |
| Price sensitivity                                                | High   | Free tier, per-student pricing, annual discounts, clear ROI from better fee collection |
| Data breach involving children's data                            | Critical | Two-layer isolation, encryption, audits, pen tests, least-privilege defaults       |
| Scope creep from school-specific customization requests          | Medium | Configuration-over-customization principle, custom fields, template editors         |

### 13.2 Assumptions

- Schools have at least one computer or smartphone with internet access for the office.
- Most guardians have an Android smartphone, or at least a feature phone that receives SMS.
- Schools will run fee collection through the platform once it supports their payment channels.
- Shared-infrastructure multi-tenancy meets the isolation expectations of the target customers.

### 13.3 Open questions

1. Should online payments settle into the school's own merchant account or go through the platform as an aggregator? This has legal and regulatory implications.
2. Do we support Qawmi madrasa grading in the MVP, or wait for Phase 2?
3. Do we offer an on-premise or dedicated-instance option for large school groups, and at what price?
4. What is the minimum subscription price at which onboarding support stays viable?
5. Which SMS provider(s) should be the primary at launch, and should masking sender IDs be bundled into plans?
6. What level of WhatsApp messaging should be included, given per-conversation costs?

Resolved in 1.3: student accounts are created only for the classes a school enables (default Class 6 and above); guardians always get an account (6.3).

---

## 14. Glossary

| Term                | Meaning                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------- |
| Tenant / Organization | A school (or branch) subscribed to the platform; the unit of data isolation            |
| Academic session    | A school year, e.g. 2026 or 2026–27                                                    |
| Section             | A division of a class, e.g. Class 6 – Section A                                         |
| Group / Stream      | Science, Business Studies or Humanities in Classes 9–12                                 |
| Shift               | Morning/day shift running separate sets of sections                                     |
| GPA 5.0             | The Bangladesh national grading scale (A+ = 5.00)                                       |
| 4th subject         | An optional subject whose grade point above 2.0 is added as a bonus to the GPA          |
| CQ / MCQ            | Creative question (written) and multiple-choice components of an exam                  |
| SSC / HSC           | Secondary / Higher Secondary Certificate board exams                                    |
| EIIN                | Educational Institution Identification Number assigned by BANBEIS                       |
| BANBEIS             | Bangladesh Bureau of Educational Information and Statistics                             |
| NCTB                | National Curriculum and Textbook Board                                                  |
| TC                  | Transfer Certificate issued when a student leaves the school                            |
| MFS                 | Mobile financial services (bKash, Nagad, Rocket)                                        |
| Masking SMS         | SMS sent with a branded sender ID (e.g. "MYSCHOOL") instead of a number                 |
| PTM                 | Parent-teacher meeting                                                                  |
| SMC / Governing body | School Managing Committee (schools, madrasas) or Governing Body (colleges): the statutory committee that oversees a non-government institution |
| RLS                 | Row-level security: database-enforced tenant isolation                                  |
| RPO / RTO           | Recovery point objective (max data loss) / recovery time objective (max downtime)       |
