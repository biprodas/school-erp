import {
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { AuthUser } from './auth-user';

const ALLOW_PENDING_PASSWORD_CHANGE = 'auth:allow-pending-password-change';

/**
 * Lets a user whose password must be changed (temporary password from an
 * invite slip or an admin) call this route anyway: change-password, me,
 * refresh, logout. Every other authenticated route answers 403
 * `PASSWORD_CHANGE_REQUIRED` until they change it.
 */
export const AllowPendingPasswordChange = () =>
  SetMetadata(ALLOW_PENDING_PASSWORD_CHANGE, true);

/** Used by both JWT guards after authentication. */
export function assertPasswordChangeAllowed(
  reflector: Reflector,
  context: ExecutionContext,
  user: AuthUser | undefined,
): void {
  if (!user?.mustChangePassword) return;
  const allowed = reflector.getAllAndOverride<boolean | undefined>(
    ALLOW_PENDING_PASSWORD_CHANGE,
    [context.getHandler(), context.getClass()],
  );
  if (!allowed) {
    throw new ForbiddenException({
      message: 'Please change your password to continue.',
      code: 'PASSWORD_CHANGE_REQUIRED',
    });
  }
}
