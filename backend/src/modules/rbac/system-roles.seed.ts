import {
  PERMISSIONS,
  PORTAL_PERMISSIONS,
  PermissionKey,
  STAFF_PERMISSIONS,
} from './permissions.catalog';
import { RoleScope } from './enums/role-scope.enum';

export interface SystemRoleSeed {
  name: string;
  description: string;
  scope: RoleScope;
  permissions: PermissionKey[];
}

const P = PERMISSIONS;

/** Name of the role granted full administrative control of a tenant. */
export const ADMIN_ROLE_NAME = 'admin';
export const GUARDIAN_ROLE_NAME = 'guardian';
export const STUDENT_ROLE_NAME = 'student';

// Building blocks for the PRD 4.4 role × module matrix. Timetable and periods
// are dormant (plan 4.1), so only the admin role holds those keys.

/** Academic setup, read-only (Teacher, Class teacher, Committee member: R). */
const ACADEMIC_SETUP_READ: PermissionKey[] = [
  P.ACADEMIC_YEARS_READ,
  P.CLASSES_READ,
  P.SECTIONS_READ,
  P.SUBJECTS_READ,
  P.SUBJECT_GROUPS_READ,
  P.CLASS_SUBJECTS_READ,
  P.CLASS_SUBJECT_GROUPS_READ,
  P.CLASS_TEACHERS_READ,
  P.SUBJECT_TEACHERS_READ,
];

/** Academic setup, create/edit without delete (Principal: W). */
const ACADEMIC_SETUP_WRITE: PermissionKey[] = [
  ...ACADEMIC_SETUP_READ,
  P.ACADEMIC_YEARS_CREATE,
  P.ACADEMIC_YEARS_UPDATE,
  P.CLASSES_CREATE,
  P.CLASSES_UPDATE,
  P.SECTIONS_CREATE,
  P.SECTIONS_UPDATE,
  P.SUBJECTS_CREATE,
  P.SUBJECTS_UPDATE,
  P.SUBJECT_GROUPS_CREATE,
  P.SUBJECT_GROUPS_UPDATE,
  P.CLASS_SUBJECTS_CREATE,
  P.CLASS_SUBJECTS_UPDATE,
  P.CLASS_SUBJECT_GROUPS_CREATE,
  P.CLASS_SUBJECT_GROUPS_UPDATE,
  P.CLASS_TEACHERS_CREATE,
  P.CLASS_TEACHERS_UPDATE,
  P.SUBJECT_TEACHERS_CREATE,
  P.SUBJECT_TEACHERS_UPDATE,
];

/**
 * Lookups a role with student read access needs to filter lists by session,
 * class and section, even where the matrix gives it no academic setup column.
 */
const STUDENT_LOOKUPS: PermissionKey[] = [
  P.ACADEMIC_YEARS_READ,
  P.CLASSES_READ,
  P.SECTIONS_READ,
];

/** Students (SIS), read-only, without health or notes (R). */
const STUDENTS_READ: PermissionKey[] = [
  P.STUDENTS_READ,
  P.ENROLLMENTS_READ,
  P.STUDENT_SUBJECTS_READ,
];

/** HR directory, read-only (Principal: R). */
const HR_READ: PermissionKey[] = [
  P.DEPARTMENTS_READ,
  P.DESIGNATIONS_READ,
  P.EMPLOYEES_READ,
];

/**
 * Standard school roles (PRD 6.3, matrix in PRD 4.4) seeded into every org on
 * creation. Admins may afterwards create or clone custom roles and adjust the
 * permissions of these seeded roles (but cannot delete or rename them). The
 * owner is not a role: the OWNER membership carries `isAdmin`.
 *
 * Existing orgs are aligned by the `AlignSystemRoles` migration, which holds a
 * frozen copy of these sets; when a later milestone adds keys to a system
 * role, its migration updates existing orgs the same way.
 */
export const SYSTEM_ROLES: SystemRoleSeed[] = [
  {
    name: ADMIN_ROLE_NAME,
    description: 'Full school administrator',
    scope: RoleScope.SCHOOL,
    permissions: [...STAFF_PERMISSIONS],
  },
  {
    name: 'principal',
    description:
      'Runs academics and students; reads settings, HR and finance summaries',
    scope: RoleScope.SCHOOL,
    permissions: [
      P.SETTINGS_READ,
      P.DOMAINS_READ,
      ...ACADEMIC_SETUP_WRITE,
      P.STUDENTS_READ,
      P.STUDENTS_CREATE,
      P.STUDENTS_UPDATE,
      P.STUDENT_DOCUMENTS_READ,
      P.STUDENT_DOCUMENTS_CREATE,
      P.STUDENT_DOCUMENTS_UPDATE,
      P.STUDENT_MEDICAL_READ,
      P.STUDENT_MEDICAL_CREATE,
      P.STUDENT_MEDICAL_UPDATE,
      P.STUDENT_NOTES_READ,
      P.STUDENT_NOTES_CREATE,
      P.STUDENT_NOTES_UPDATE,
      P.GUARDIANS_READ,
      P.GUARDIANS_CREATE,
      P.GUARDIANS_UPDATE,
      P.ENROLLMENTS_READ,
      P.ENROLLMENTS_CREATE,
      P.ENROLLMENTS_UPDATE,
      P.STUDENT_SUBJECTS_READ,
      P.STUDENT_SUBJECTS_CREATE,
      P.STUDENT_SUBJECTS_UPDATE,
      P.PROMOTIONS_READ,
      P.PROMOTIONS_CREATE,
      P.PROMOTIONS_UPDATE,
      ...HR_READ,
    ],
  },
  {
    name: 'accountant',
    description: 'Fees and finance; reads students and staff',
    scope: RoleScope.SCHOOL,
    permissions: [
      ...STUDENT_LOOKUPS,
      ...STUDENTS_READ,
      P.GUARDIANS_READ,
      ...HR_READ,
    ],
  },
  {
    name: 'teacher',
    description: 'Teaching staff, limited to the sections and subjects taught',
    scope: RoleScope.ASSIGNED,
    permissions: [
      ...ACADEMIC_SETUP_READ,
      ...STUDENTS_READ,
      P.STUDENT_DOCUMENTS_READ,
      P.STUDENT_NOTES_READ,
      P.GUARDIANS_READ,
    ],
  },
  {
    name: 'class_teacher',
    description: 'Teacher who also manages the students of their own section',
    scope: RoleScope.ASSIGNED,
    permissions: [
      ...ACADEMIC_SETUP_READ,
      ...STUDENTS_READ,
      P.STUDENTS_UPDATE,
      P.STUDENT_DOCUMENTS_READ,
      P.STUDENT_DOCUMENTS_CREATE,
      P.STUDENT_DOCUMENTS_UPDATE,
      P.STUDENT_MEDICAL_READ,
      P.STUDENT_NOTES_READ,
      P.STUDENT_NOTES_CREATE,
      P.STUDENT_NOTES_UPDATE,
      P.GUARDIANS_READ,
      P.GUARDIANS_UPDATE,
    ],
  },
  {
    name: 'receptionist',
    description: 'Front desk: admissions, student records and fee collection',
    scope: RoleScope.SCHOOL,
    permissions: [
      ...STUDENT_LOOKUPS,
      ...STUDENTS_READ,
      P.STUDENTS_CREATE,
      P.STUDENT_DOCUMENTS_READ,
      P.STUDENT_DOCUMENTS_CREATE,
      P.GUARDIANS_READ,
      P.GUARDIANS_CREATE,
      P.GUARDIANS_UPDATE,
      P.ENROLLMENTS_CREATE,
    ],
  },
  {
    name: 'librarian',
    description: 'Library management; reads students',
    scope: RoleScope.SCHOOL,
    permissions: [...STUDENT_LOOKUPS, ...STUDENTS_READ],
  },
  {
    // Read-only by design: never student health, notes or guardian details.
    name: 'committee_member',
    description:
      'Managing committee: read-only settings, academic setup and reports',
    scope: RoleScope.SCHOOL,
    permissions: [P.SETTINGS_READ, P.DOMAINS_READ, ...ACADEMIC_SETUP_READ],
  },
  {
    name: STUDENT_ROLE_NAME,
    description: 'Student (portal only)',
    scope: RoleScope.SCHOOL,
    permissions: [...PORTAL_PERMISSIONS],
  },
  {
    name: GUARDIAN_ROLE_NAME,
    description: 'Parent or guardian (portal only)',
    scope: RoleScope.SCHOOL,
    permissions: [...PORTAL_PERMISSIONS],
  },
];

export const SYSTEM_ROLE_NAMES: ReadonlySet<string> = new Set(
  SYSTEM_ROLES.map((r) => r.name),
);
