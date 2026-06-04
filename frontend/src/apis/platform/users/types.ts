/** Platform user data structures, mirroring the NestJS platform user entity/DTOs. */

export const USER_STATUSES = [
  "pending",
  "active",
  "suspended",
  "deactivated",
  "banned",
] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const PLATFORM_ROLES = ["admin", "user"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export interface PlatformUserRow {
  id: string;
  email: string;
  name: string;
  role: PlatformRole;
  status: UserStatus;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role?: PlatformRole;
  status?: UserStatus;
  isAdmin?: boolean;
}

export interface UpdateUserPayload {
  name?: string;
  role?: PlatformRole;
  status?: UserStatus;
  isAdmin?: boolean;
}
