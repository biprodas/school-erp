/** Platform user data structures, mirroring the NestJS platform user entity/DTOs. */

export const USER_STATUSES = [
  "pending",
  "active",
  "suspended",
  "deactivated",
  "banned",
] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export interface PlatformUserRow {
  id: string;
  email: string;
  name: string;
  status: UserStatus;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  status?: UserStatus;
  isAdmin?: boolean;
}

export interface UpdateUserPayload {
  name?: string;
  status?: UserStatus;
  isAdmin?: boolean;
}
