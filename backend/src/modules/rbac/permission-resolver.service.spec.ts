import { PermissionResolverService } from './permission-resolver.service';
import { UserRoleRepository } from './user-role.repository';
import { PERMISSIONS } from './permissions.catalog';

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
        role: { permissions: [PERMISSIONS.CATS_READ, PERMISSIONS.CATS_CREATE] },
      },
      {
        role: {
          permissions: [PERMISSIONS.CATS_CREATE, PERMISSIONS.TASKS_READ],
        },
      },
    ]);

    const perms = await service.getEffectivePermissions('u1');

    expect([...perms].sort()).toEqual(
      [
        PERMISSIONS.CATS_CREATE,
        PERMISSIONS.CATS_READ,
        PERMISSIONS.TASKS_READ,
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
      { role: { permissions: [PERMISSIONS.TASKS_READ] } },
    ]);

    const perms = await service.getEffectivePermissions('u1');

    expect([...perms]).toEqual([PERMISSIONS.TASKS_READ]);
  });
});
