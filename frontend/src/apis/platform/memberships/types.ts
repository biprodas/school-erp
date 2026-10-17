/** Membership data structures, mirroring the NestJS platform membership entity/DTOs. */

export const MEMBERSHIP_ROLES = ["owner", "admin", "member"] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export interface Membership {
  id: string;
  userId: string;
  orgId: string;
  role: MembershipRole;
  isAdmin: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMembershipPayload {
  userId: string;
  orgId: string;
  role?: MembershipRole;
}

export interface UpdateMembershipRolePayload {
  role: MembershipRole;
}
