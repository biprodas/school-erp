import {
  ALL_PERMISSIONS,
  PERMISSIONS,
  PermissionKey,
} from './permissions.catalog';

export interface SystemRoleSeed {
  name: string;
  description: string;
  permissions: PermissionKey[];
}

const P = PERMISSIONS;

/** Name of the role granted full administrative control of a tenant. */
export const ADMIN_ROLE_NAME = 'admin';

/**
 * Standard school roles seeded into every tenant schema on creation.
 * Tenant admins may afterwards create custom roles or adjust the
 * permissions of these seeded roles (but cannot delete or rename them).
 */
export const SYSTEM_ROLES: SystemRoleSeed[] = [
  {
    name: ADMIN_ROLE_NAME,
    description: 'Full tenant administrator',
    permissions: [...ALL_PERMISSIONS],
  },
  {
    name: 'staff',
    description: 'General school staff',
    permissions: [
      P.USERS_READ,
      P.STUDENTS_READ,
      P.STUDENTS_CREATE,
      P.STUDENTS_UPDATE,
      P.STUDENTS_DELETE,
      P.DEPARTMENTS_READ,
      P.DESIGNATIONS_READ,
      P.EMPLOYEES_READ,
      P.EMPLOYEES_CREATE,
      P.EMPLOYEES_UPDATE,
      P.EMPLOYEES_DELETE,
      P.GUARDIANS_READ,
      P.GUARDIANS_CREATE,
      P.GUARDIANS_UPDATE,
      P.GUARDIANS_DELETE,
      P.STAKEHOLDERS_READ,
      P.STAKEHOLDERS_CREATE,
      P.STAKEHOLDERS_UPDATE,
      P.STAKEHOLDERS_DELETE,
      P.CATS_READ,
      P.CATS_CREATE,
      P.CATS_UPDATE,
      P.CATS_DELETE,
      P.TASKS_READ,
      P.TASKS_CREATE,
      P.TASKS_UPDATE,
      P.TASKS_DELETE,
      P.PRODUCTS_READ,
    ],
  },
  {
    name: 'teacher',
    description: 'Teaching staff',
    permissions: [
      P.USERS_READ,
      P.STUDENTS_READ,
      P.DEPARTMENTS_READ,
      P.DESIGNATIONS_READ,
      P.EMPLOYEES_READ,
      P.GUARDIANS_READ,
      P.TASKS_READ,
      P.TASKS_CREATE,
      P.TASKS_UPDATE,
      P.CATS_READ,
      P.PRODUCTS_READ,
    ],
  },
  {
    name: 'accountant',
    description: 'Finance and inventory',
    permissions: [
      P.USERS_READ,
      P.STUDENTS_READ,
      P.DEPARTMENTS_READ,
      P.DESIGNATIONS_READ,
      P.EMPLOYEES_READ,
      P.PRODUCTS_READ,
      P.PRODUCTS_CREATE,
      P.PRODUCTS_UPDATE,
      P.PRODUCTS_DELETE,
    ],
  },
  {
    name: 'librarian',
    description: 'Library management',
    permissions: [
      P.USERS_READ,
      P.STUDENTS_READ,
      P.DEPARTMENTS_READ,
      P.DESIGNATIONS_READ,
      P.EMPLOYEES_READ,
      P.CATS_READ,
      P.CATS_CREATE,
      P.CATS_UPDATE,
      P.CATS_DELETE,
      P.PRODUCTS_READ,
    ],
  },
  {
    name: 'parent',
    description: 'Parent or guardian',
    permissions: [P.STUDENTS_READ, P.TASKS_READ, P.PRODUCTS_READ],
  },
  {
    name: 'student',
    description: 'Student',
    permissions: [P.TASKS_READ],
  },
  {
    name: 'stakeholder',
    description: 'External member or stakeholder',
    permissions: [],
  },
];

export const SYSTEM_ROLE_NAMES: ReadonlySet<string> = new Set(
  SYSTEM_ROLES.map((r) => r.name),
);
