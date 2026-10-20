import { PermissionResolverService } from './permission-resolver.service';
import { UserRoleRepository } from '../repositories/user-role.repository';
import { PERMISSIONS } from '../permissions.catalog';
import { RoleScope } from '../enums/role-scope.enum';

describe('PermissionResolverService', () => {
  let service: PermissionResolverService;
  let userRoleRepo: { findByUserId: jest.Mock };

  beforeEach(() => {
    userRoleRepo = { findByUserId: jest.fn() };
    service = new PermissionResolverService(
      userRoleRepo as unknown as UserRoleRepository,
    );
  });

  it('returns the union of permissions across all assigned roles', async () => {
    userRoleRepo.findByUserId.mockResolvedValue([
      {
        role: {
          permissions: [PERMISSIONS.CLASSES_READ, PERMISSIONS.CLASSES_CREATE],
        },
      },
      {
        role: {
          permissions: [PERMISSIONS.CLASSES_CREATE, PERMISSIONS.SUBJECTS_READ],
        },
      },
    ]);

    const perms = await service.getEffectivePermissions('u1');

    expect([...perms].sort()).toEqual(
      [
        PERMISSIONS.CLASSES_CREATE,
        PERMISSIONS.CLASSES_READ,
        PERMISSIONS.SUBJECTS_READ,
      ].sort(),
    );
  });

  it('returns an empty set for a user with no roles', async () => {
    userRoleRepo.findByUserId.mockResolvedValue([]);

    const perms = await service.getEffectivePermissions('u1');

    expect(perms.size).toBe(0);
  });

  it('skips assignments whose role could not be loaded', async () => {
    userRoleRepo.findByUserId.mockResolvedValue([
      { role: null },
      { role: { permissions: [PERMISSIONS.SUBJECTS_READ] } },
    ]);

    const perms = await service.getEffectivePermissions('u1');

    expect([...perms]).toEqual([PERMISSIONS.SUBJECTS_READ]);
  });

  describe('getPermissionScopes', () => {
    it('keeps the widest scope among the roles granting a key', async () => {
      userRoleRepo.findByUserId.mockResolvedValue([
        {
          role: {
            scope: RoleScope.ASSIGNED,
            permissions: [PERMISSIONS.STUDENTS_READ, PERMISSIONS.CLASSES_READ],
          },
        },
        {
          role: {
            scope: RoleScope.SCHOOL,
            permissions: [PERMISSIONS.STUDENTS_READ],
          },
        },
      ]);

      const scopes = await service.getPermissionScopes('u1');

      expect(scopes.get(PERMISSIONS.STUDENTS_READ)).toBe(RoleScope.SCHOOL);
      expect(scopes.get(PERMISSIONS.CLASSES_READ)).toBe(RoleScope.ASSIGNED);
      expect(scopes.has(PERMISSIONS.SUBJECTS_READ)).toBe(false);
    });

    it('does not narrow a school-wide grant when an assigned role comes later', async () => {
      userRoleRepo.findByUserId.mockResolvedValue([
        {
          role: {
            scope: RoleScope.SCHOOL,
            permissions: [PERMISSIONS.STUDENTS_READ],
          },
        },
        {
          role: {
            scope: RoleScope.ASSIGNED,
            permissions: [PERMISSIONS.STUDENTS_READ],
          },
        },
      ]);

      const scopes = await service.getPermissionScopes('u1');

      expect(scopes.get(PERMISSIONS.STUDENTS_READ)).toBe(RoleScope.SCHOOL);
    });

    it('reads the roles once per request', async () => {
      userRoleRepo.findByUserId.mockResolvedValue([]);

      await service.getEffectivePermissions('u1');
      await service.getPermissionScopes('u1');
      await service.getRoles('u1');

      expect(userRoleRepo.findByUserId).toHaveBeenCalledTimes(1);
    });
  });
});
