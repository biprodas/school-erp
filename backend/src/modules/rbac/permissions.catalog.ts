/**
 * The permission catalog is the single source of truth for every feature
 * that can be access-controlled inside a tenant. Permission keys follow the
 * `resource:action` convention. Roles (stored per tenant in the DB) reference
 * these keys; the catalog itself is code-defined so it never drifts from the
 * endpoints it guards.
 */
export const PERMISSIONS = {
  // Tenant users
  USERS_READ: 'users:read',
  USERS_CREATE: 'users:create',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',

  // Students
  STUDENTS_READ: 'students:read',
  STUDENTS_CREATE: 'students:create',
  STUDENTS_UPDATE: 'students:update',
  STUDENTS_DELETE: 'students:delete',
  /** Excel import of students with guardians (PRD 6.2). */
  STUDENTS_IMPORT: 'students:import',
  /** Student list export (Excel/PDF); audited. */
  STUDENTS_EXPORT: 'students:export',
  /** Bulk ID card PDFs (PRD 6.6). */
  ID_CARDS_PRINT: 'id_cards:print',

  // Student documents
  STUDENT_DOCUMENTS_READ: 'student_documents:read',
  STUDENT_DOCUMENTS_CREATE: 'student_documents:create',
  STUDENT_DOCUMENTS_UPDATE: 'student_documents:update',
  STUDENT_DOCUMENTS_DELETE: 'student_documents:delete',

  // Student medical records
  STUDENT_MEDICAL_READ: 'student_medical:read',
  STUDENT_MEDICAL_CREATE: 'student_medical:create',
  STUDENT_MEDICAL_UPDATE: 'student_medical:update',
  STUDENT_MEDICAL_DELETE: 'student_medical:delete',

  // Student notes
  STUDENT_NOTES_READ: 'student_notes:read',
  STUDENT_NOTES_CREATE: 'student_notes:create',
  STUDENT_NOTES_UPDATE: 'student_notes:update',
  STUDENT_NOTES_DELETE: 'student_notes:delete',
  /** Health, disciplinary and counselling notes (PRD 6.6). */
  STUDENT_NOTES_READ_SENSITIVE: 'student_notes:read_sensitive',

  // Certificates (TC, testimonial, character, study)
  CERTIFICATES_READ: 'certificates:read',
  CERTIFICATES_ISSUE: 'certificates:issue',
  CERTIFICATES_REVOKE: 'certificates:revoke',

  // Departments
  DEPARTMENTS_READ: 'departments:read',
  DEPARTMENTS_CREATE: 'departments:create',
  DEPARTMENTS_UPDATE: 'departments:update',
  DEPARTMENTS_DELETE: 'departments:delete',

  // Designations
  DESIGNATIONS_READ: 'designations:read',
  DESIGNATIONS_CREATE: 'designations:create',
  DESIGNATIONS_UPDATE: 'designations:update',
  DESIGNATIONS_DELETE: 'designations:delete',

  // Employees
  EMPLOYEES_READ: 'employees:read',
  EMPLOYEES_CREATE: 'employees:create',
  EMPLOYEES_UPDATE: 'employees:update',
  EMPLOYEES_DELETE: 'employees:delete',
  /** Staff Excel import. */
  EMPLOYEES_IMPORT: 'employees:import',

  // Guardians
  GUARDIANS_READ: 'guardians:read',
  GUARDIANS_CREATE: 'guardians:create',
  GUARDIANS_UPDATE: 'guardians:update',
  GUARDIANS_DELETE: 'guardians:delete',

  // Academic years
  ACADEMIC_YEARS_READ: 'academic_years:read',
  ACADEMIC_YEARS_CREATE: 'academic_years:create',
  ACADEMIC_YEARS_UPDATE: 'academic_years:update',
  ACADEMIC_YEARS_DELETE: 'academic_years:delete',
  /** Copy a session's structure into another (PRD 6.4 rollover). */
  ACADEMIC_YEARS_ROLLOVER: 'academic_years:rollover',

  // Terms inside a session
  TERMS_READ: 'terms:read',
  TERMS_CREATE: 'terms:create',
  TERMS_UPDATE: 'terms:update',
  TERMS_DELETE: 'terms:delete',

  // Shifts (morning/day)
  SHIFTS_READ: 'shifts:read',
  SHIFTS_CREATE: 'shifts:create',
  SHIFTS_UPDATE: 'shifts:update',
  SHIFTS_DELETE: 'shifts:delete',

  // Rooms and buildings
  ROOMS_READ: 'rooms:read',
  ROOMS_CREATE: 'rooms:create',
  ROOMS_UPDATE: 'rooms:update',
  ROOMS_DELETE: 'rooms:delete',

  // Classes (permanent)
  CLASSES_READ: 'classes:read',
  CLASSES_CREATE: 'classes:create',
  CLASSES_UPDATE: 'classes:update',
  CLASSES_DELETE: 'classes:delete',

  // Sections (per class and session)
  SECTIONS_READ: 'sections:read',
  SECTIONS_CREATE: 'sections:create',
  SECTIONS_UPDATE: 'sections:update',
  SECTIONS_DELETE: 'sections:delete',

  // Subjects
  SUBJECTS_READ: 'subjects:read',
  SUBJECTS_CREATE: 'subjects:create',
  SUBJECTS_UPDATE: 'subjects:update',
  SUBJECTS_DELETE: 'subjects:delete',

  // Subject groups
  SUBJECT_GROUPS_READ: 'subject_groups:read',
  SUBJECT_GROUPS_CREATE: 'subject_groups:create',
  SUBJECT_GROUPS_UPDATE: 'subject_groups:update',
  SUBJECT_GROUPS_DELETE: 'subject_groups:delete',

  // Class subjects (per-class+year subject offerings, with their components)
  CLASS_SUBJECTS_READ: 'class_subjects:read',
  CLASS_SUBJECTS_CREATE: 'class_subjects:create',
  CLASS_SUBJECTS_UPDATE: 'class_subjects:update',
  CLASS_SUBJECTS_DELETE: 'class_subjects:delete',

  // Class subject groups (per-class+year group availability)
  CLASS_SUBJECT_GROUPS_READ: 'class_subject_groups:read',
  CLASS_SUBJECT_GROUPS_CREATE: 'class_subject_groups:create',
  CLASS_SUBJECT_GROUPS_UPDATE: 'class_subject_groups:update',
  CLASS_SUBJECT_GROUPS_DELETE: 'class_subject_groups:delete',

  // Student enrollments
  ENROLLMENTS_READ: 'enrollments:read',
  ENROLLMENTS_CREATE: 'enrollments:create',
  ENROLLMENTS_UPDATE: 'enrollments:update',
  ENROLLMENTS_DELETE: 'enrollments:delete',
  /** Enroll into a section that is at capacity. */
  ENROLLMENTS_OVERRIDE_CAPACITY: 'enrollments:override_capacity',

  // Student subject selections
  STUDENT_SUBJECTS_READ: 'student_subjects:read',
  STUDENT_SUBJECTS_CREATE: 'student_subjects:create',
  STUDENT_SUBJECTS_DELETE: 'student_subjects:delete',

  // Class teachers
  CLASS_TEACHERS_READ: 'class_teachers:read',
  CLASS_TEACHERS_CREATE: 'class_teachers:create',
  CLASS_TEACHERS_UPDATE: 'class_teachers:update',
  CLASS_TEACHERS_DELETE: 'class_teachers:delete',

  // Subject teachers
  SUBJECT_TEACHERS_READ: 'subject_teachers:read',
  SUBJECT_TEACHERS_CREATE: 'subject_teachers:create',
  SUBJECT_TEACHERS_UPDATE: 'subject_teachers:update',
  SUBJECT_TEACHERS_DELETE: 'subject_teachers:delete',

  // Periods
  PERIODS_READ: 'periods:read',
  PERIODS_CREATE: 'periods:create',
  PERIODS_UPDATE: 'periods:update',
  PERIODS_DELETE: 'periods:delete',

  // Timetables
  TIMETABLES_READ: 'timetables:read',
  TIMETABLES_CREATE: 'timetables:create',
  TIMETABLES_UPDATE: 'timetables:update',
  TIMETABLES_DELETE: 'timetables:delete',

  // Student promotions
  PROMOTIONS_READ: 'promotions:read',
  PROMOTIONS_CREATE: 'promotions:create',
  PROMOTIONS_DELETE: 'promotions:delete',
  /** Commit and roll back a promotion batch. */
  PROMOTIONS_COMMIT: 'promotions:commit',

  // Custom domains (Settings → Domain)
  DOMAINS_READ: 'domains:read',
  DOMAINS_MANAGE: 'domains:manage',

  // Access control management
  ROLES_READ: 'roles:read',
  ROLES_MANAGE: 'roles:manage',
  ROLES_ASSIGN: 'roles:assign',

  // Audit log
  AUDIT_READ: 'audit:read',

  // School settings (PRD 6.24)
  SETTINGS_READ: 'settings:read',
  SETTINGS_UPDATE: 'settings:update',

  // Onboarding checklist and setup templates (PRD 6.2)
  ONBOARDING_MANAGE: 'onboarding:manage',

  // Guardian/student portal (the /portal endpoints, M7)
  PORTAL_ACCESS: 'portal:access',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS = Object.values(PERMISSIONS) as PermissionKey[];

/**
 * Portal keys, held only by the guardian and student roles. Those roles get
 * nothing else, so their tokens are refused on every staff endpoint.
 */
export const PORTAL_PERMISSIONS = ALL_PERMISSIONS.filter((key) =>
  key.startsWith('portal:'),
);

/** Every key except the portal ones: what the admin role holds. */
export const STAFF_PERMISSIONS = ALL_PERMISSIONS.filter(
  (key) => !key.startsWith('portal:'),
);

/** O(1) lookup set used to validate permission keys coming from clients. */
export const PERMISSION_SET: ReadonlySet<string> = new Set(ALL_PERMISSIONS);

export interface PermissionGroup {
  resource: string;
  permissions: { key: PermissionKey; action: string }[];
}

/** Returns the catalog grouped by resource — used by `GET /permissions`. */
export function getPermissionCatalog(): PermissionGroup[] {
  const groups = new Map<string, PermissionGroup>();
  for (const key of ALL_PERMISSIONS) {
    const [resource, action] = key.split(':');
    if (!groups.has(resource)) {
      groups.set(resource, { resource, permissions: [] });
    }
    groups.get(resource)!.permissions.push({ key, action });
  }
  return [...groups.values()];
}
