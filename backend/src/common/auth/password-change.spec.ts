import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AllowPendingPasswordChange,
  assertPasswordChangeAllowed,
} from './password-change';

class Routes {
  @AllowPendingPasswordChange()
  changePassword(this: void) {}

  listStudents(this: void) {}
}

const context = (handler: () => void) =>
  ({ getHandler: () => handler, getClass: () => Routes }) as never;

describe('assertPasswordChangeAllowed', () => {
  const reflector = new Reflector();
  const user = { userId: 'u-1', isAdmin: false, sessionId: 's-1' };

  it('lets users without a pending change through anywhere', () => {
    expect(() =>
      assertPasswordChangeAllowed(
        reflector,
        context(Routes.prototype.listStudents),
        user,
      ),
    ).not.toThrow();
  });

  it('blocks other routes while a password change is pending', () => {
    expect(() =>
      assertPasswordChangeAllowed(
        reflector,
        context(Routes.prototype.listStudents),
        { ...user, mustChangePassword: true },
      ),
    ).toThrow(ForbiddenException);
  });

  it('allows routes marked @AllowPendingPasswordChange()', () => {
    expect(() =>
      assertPasswordChangeAllowed(
        reflector,
        context(Routes.prototype.changePassword),
        { ...user, mustChangePassword: true },
      ),
    ).not.toThrow();
  });
});
