import type { UserStatus } from '~/modules/users/enums/user-status.enum';

/**
 * What both JWT strategies put on `req.user`: the tenant strategy adds
 * `orgId`, the platform strategy adds `status`.
 */
export interface AuthUser {
  userId: string;
  email: string;
  /** School admin (tenant tokens) or platform super-admin (platform tokens). */
  isAdmin: boolean;
  orgId?: string;
  status?: UserStatus;
}

// Types `req.user` everywhere (Passport declares it as `Express.User`).
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends AuthUser {}
  }
}
