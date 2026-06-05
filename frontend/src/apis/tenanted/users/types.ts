/** Tenant user data structures, mirroring the NestJS tenanted user entity/DTOs. */

export const USER_STATUSES = [
  "pending",
  "active",
  "suspended",
  "deactivated",
  "banned",
] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/** A role reference as embedded in a user row. */
export interface UserRoleRef {
  id: string;
  name: string;
}

export interface TenantUserRow {
  id: string;
  email: string;
  name: string;
  status: UserStatus;
  isAdmin: boolean;
  roles: UserRoleRef[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  status?: UserStatus;
  roleIds?: string[];
}

/** PATCH /users/:id only updates name + status (roles go through the
 * dedicated /users/:id/roles assign/unassign endpoints). */
export interface UpdateUserPayload {
  name?: string;
  status?: UserStatus;
}
