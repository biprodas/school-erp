import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PLATFORM_PERMISSIONS as P } from '~/common/auth/platform-permissions';
import { PlatformRole } from '~/modules/users/enums/platform-role.enum';
import { PlatformPermissionsGuard } from './platform-permissions.guard';

describe('PlatformPermissionsGuard', () => {
  const reflector = new Reflector();
  const guard = new PlatformPermissionsGuard(reflector);
  const context = (platformRole?: PlatformRole) =>
    ({
      getHandler: () => () => undefined,
      getClass: () => class {},
      switchToHttp: () => ({ getRequest: () => ({ user: { platformRole } }) }),
    }) as unknown as ExecutionContext;
  const requiring = (...keys: string[]) =>
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(keys);

  afterEach(() => jest.restoreAllMocks());

  it('lets a handler without requirements through', () => {
    requiring();
    expect(guard.canActivate(context(PlatformRole.USER))).toBe(true);
  });

  it('passes a role holding any one of the permissions', () => {
    requiring(P.ORGANIZATIONS_MANAGE, P.ORGANIZATIONS_SUPPORT);
    expect(guard.canActivate(context(PlatformRole.SUPPORT))).toBe(true);
  });

  it('refuses a role without them, and a token without a role', () => {
    requiring(P.ORGANIZATIONS_MANAGE);
    expect(() => guard.canActivate(context(PlatformRole.SUPPORT))).toThrow(
      ForbiddenException,
    );
    expect(() => guard.canActivate(context())).toThrow(ForbiddenException);
  });
});
