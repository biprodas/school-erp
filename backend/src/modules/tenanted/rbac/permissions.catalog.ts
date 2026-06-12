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

  // Cats
  CATS_READ: 'cats:read',
  CATS_CREATE: 'cats:create',
  CATS_UPDATE: 'cats:update',
  CATS_DELETE: 'cats:delete',

  // Tasks
  TASKS_READ: 'tasks:read',
  TASKS_CREATE: 'tasks:create',
  TASKS_UPDATE: 'tasks:update',
  TASKS_DELETE: 'tasks:delete',

  // Products
  PRODUCTS_READ: 'products:read',
  PRODUCTS_CREATE: 'products:create',
  PRODUCTS_UPDATE: 'products:update',
  PRODUCTS_DELETE: 'products:delete',

  // Access control management
  ROLES_READ: 'roles:read',
  ROLES_MANAGE: 'roles:manage',
  ROLES_ASSIGN: 'roles:assign',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS = Object.values(PERMISSIONS) as PermissionKey[];

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
