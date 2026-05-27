import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { RoleService } from './role.service';
import { RoleRepository } from './role.repository';
import { UserRoleRepository } from './user-role.repository';
import { Role } from './entities/role.entity';
import { PERMISSIONS } from './permissions.catalog';
import { ADMIN_ROLE_NAME } from './system-roles.seed';

const makeRole = (overrides: Partial<Role> = {}): Role => ({
  id: 'role-1',
  name: 'teacher',
  description: null,
  permissions: [PERMISSIONS.TASKS_READ],
  isSystem: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  userRoles: [],
  ...overrides,
});

describe('RoleService', () => {
  let service: RoleService;
  let roleRepo: Record<string, jest.Mock>;
  let userRoleRepo: Record<string, jest.Mock>;

  beforeEach(() => {
    roleRepo = {
      findAll: jest.fn(),
      findByIdOrFail: jest.fn(),
      findByName: jest.fn(),
      saveNew: jest.fn((data) => Promise.resolve({ id: 'new-role', ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      deleteById: jest.fn(),
    };
    userRoleRepo = {
      countByRoleId: jest.fn(),
      findByRoleId: jest.fn(),
      findByUserId: jest.fn(),
      assign: jest.fn(),
      unassign: jest.fn(),
    };
    service = new RoleService(
      roleRepo as unknown as RoleRepository,
      userRoleRepo as unknown as UserRoleRepository,
    );
  });

  describe('create', () => {
    it('creates a non-system role with validated permissions', async () => {
      roleRepo.findByName.mockResolvedValue(null);

      const result = await service.create({
        name: 'coach',
        permissions: [PERMISSIONS.TASKS_READ, PERMISSIONS.TASKS_READ],
      });

      expect(result.isSystem).toBe(false);
      // duplicate permission keys are de-duplicated
      expect(result.permissions).toEqual([PERMISSIONS.TASKS_READ]);
    });

    it('rejects a duplicate role name', async () => {
      roleRepo.findByName.mockResolvedValue(makeRole());

      await expect(service.create({ name: 'teacher' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('rejects unknown permission keys', async () => {
      roleRepo.findByName.mockResolvedValue(null);

      await expect(
        service.create({ name: 'coach', permissions: ['cats:fly'] }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('refuses to rename a system role', async () => {
      roleRepo.findByIdOrFail.mockResolvedValue(
        makeRole({ name: ADMIN_ROLE_NAME, isSystem: true }),
      );

      await expect(
        service.update('role-1', { name: 'superadmin' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows adjusting the permissions of a system role', async () => {
      roleRepo.findByIdOrFail.mockResolvedValue(
        makeRole({ name: 'student', isSystem: true }),
      );

      const result = await service.update('role-1', {
        permissions: [PERMISSIONS.TASKS_READ, PERMISSIONS.CATS_READ],
      });

      expect(result.permissions).toEqual([
        PERMISSIONS.TASKS_READ,
        PERMISSIONS.CATS_READ,
      ]);
    });
  });

  describe('remove', () => {
    it('refuses to delete a system role', async () => {
      roleRepo.findByIdOrFail.mockResolvedValue(makeRole({ isSystem: true }));

      await expect(service.remove('role-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('refuses to delete a role still assigned to users without force', async () => {
      roleRepo.findByIdOrFail.mockResolvedValue(makeRole());
      userRoleRepo.countByRoleId.mockResolvedValue(3);

      await expect(service.remove('role-1')).rejects.toThrow(ConflictException);
      expect(roleRepo.deleteById).not.toHaveBeenCalled();
    });

    it('deletes an assigned role when force is set', async () => {
      roleRepo.findByIdOrFail.mockResolvedValue(makeRole());
      userRoleRepo.countByRoleId.mockResolvedValue(3);

      await service.remove('role-1', true);

      expect(roleRepo.deleteById).toHaveBeenCalledWith('role-1');
    });
  });

  describe('unassignRole', () => {
    it('prevents removing the last admin role assignment', async () => {
      roleRepo.findByIdOrFail.mockResolvedValue(
        makeRole({ id: 'admin-role', name: ADMIN_ROLE_NAME, isSystem: true }),
      );
      userRoleRepo.findByRoleId.mockResolvedValue([{ userId: 'u1' }]);

      await expect(service.unassignRole('u1', 'admin-role')).rejects.toThrow(
        ConflictException,
      );
    });

    it('allows removing an admin assignment when other admins remain', async () => {
      roleRepo.findByIdOrFail.mockResolvedValue(
        makeRole({ id: 'admin-role', name: ADMIN_ROLE_NAME, isSystem: true }),
      );
      userRoleRepo.findByRoleId.mockResolvedValue([
        { userId: 'u1' },
        { userId: 'u2' },
      ]);

      await service.unassignRole('u1', 'admin-role');

      expect(userRoleRepo.unassign).toHaveBeenCalledWith('u1', 'admin-role');
    });
  });
});
