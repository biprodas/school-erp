import { PlatformRole } from '~/modules/users/enums/platform-role.enum';
import {
  PLATFORM_PERMISSIONS as P,
  PLATFORM_ROLE_PERMISSIONS,
  platformCan,
  platformPermissionsOf,
} from './platform-permissions';

describe('platform permissions', () => {
  it('gives super_admin every permission', () => {
    expect([...platformPermissionsOf(PlatformRole.SUPER_ADMIN)].sort()).toEqual(
      Object.values(P).sort(),
    );
  });

  it('lets admin run schools but not change platform staff', () => {
    expect(platformCan(PlatformRole.ADMIN, P.ORGANIZATIONS_MANAGE)).toBe(true);
    expect(platformCan(PlatformRole.ADMIN, P.PLATFORM_USERS_READ)).toBe(true);
    expect(platformCan(PlatformRole.ADMIN, P.PLATFORM_USERS_MANAGE)).toBe(
      false,
    );
  });

  it.each([PlatformRole.SUPPORT, PlatformRole.DEVELOPER])(
    '%s opens the console and reads, but changes nothing',
    (role) => {
      expect(platformCan(role, P.CONSOLE_ACCESS)).toBe(true);
      expect(platformCan(role, P.ORGANIZATIONS_READ)).toBe(true);
      expect(platformCan(role, P.AUDIT_READ)).toBe(true);
      expect(platformCan(role, P.ORGANIZATIONS_MANAGE)).toBe(false);
      expect(platformCan(role, P.PLATFORM_USERS_MANAGE)).toBe(false);
    },
  );

  it('lets only support (of the read-only roles) resend owner activation', () => {
    expect(platformCan(PlatformRole.SUPPORT, P.ORGANIZATIONS_SUPPORT)).toBe(
      true,
    );
    expect(platformCan(PlatformRole.DEVELOPER, P.ORGANIZATIONS_SUPPORT)).toBe(
      false,
    );
  });

  it('gives a plain user, an unknown or a missing role nothing', () => {
    expect(PLATFORM_ROLE_PERMISSIONS[PlatformRole.USER]).toEqual([]);
    expect(platformPermissionsOf('root')).toEqual([]);
    expect(platformPermissionsOf(undefined)).toEqual([]);
  });

  it('gives every console role console access', () => {
    for (const [role, keys] of Object.entries(PLATFORM_ROLE_PERMISSIONS)) {
      expect([
        role,
        keys.length === 0 || keys.includes(P.CONSOLE_ACCESS),
      ]).toEqual([role, true]);
    }
  });
});
