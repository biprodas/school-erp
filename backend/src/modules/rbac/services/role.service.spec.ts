import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { RoleService } from './role.service';
import { RoleRepository } from '../repositories/role.repository';
import { UserRoleRepository } from '../repositories/user-role.repository';
import { Role } from '../entities/role.entity';
import { ALL_PERMISSIONS, PERMISSIONS } from '../permissions.catalog';
import { ADMIN_ROLE_NAME } from '../system-roles.seed';
import { RoleScope } from '../enums/role-scope.enum';
import { AuditService } from '~/modules/audit/services/audit.service';
import { fakeTenantDataSource } from '~/tenancy/tenant-datasource.testing';
import type { RequestContext } from '~/shared/request-context/request-context.service';
import type { PermissionResolverService } from './permission-resolver.service';

/** `expect.objectContaining` typed, for nesting inside matcher objects. */
const like = (shape: object): unknown =>
  expect.objectContaining(shape) as unknown;

const makeRole = (overrides: Partial<Role> = {}): Role => ({
  id: 'role-1',
  orgId: 'org-1',
  name: 'teacher',
  description: null,
  permissions: [PERMISSIONS.STUDENTS_READ],
  scope: RoleScope.SCHOOL,
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
  let audit: { record: jest.Mock };
  /** The signed-in user: a school admin unless a test says otherwise. */
  let actor: { userId: string | null; isAdmin: boolean };
  /** What the signed-in user holds, key → scope. */
  let held: Map<string, RoleScope>;

  beforeEach(() => {
    actor = { userId: 'actor', isAdmin: true };
    held = new Map();
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
      findAssignment: jest.fn(),
      assign: jest.fn(),
      unassign: jest.fn(),
    };
    audit = { record: jest.fn() };
    service = new RoleService(
      roleRepo as unknown as RoleRepository,
      userRoleRepo as unknown as UserRoleRepository,
      audit as unknown as AuditService,
      {
        getPermissionScopes: () => Promise.resolve(held),
        getEffectivePermissions: () => Promise.resolve(new Set(held.keys())),
      } as unknown as PermissionResolverService,
      { current: () => actor } as unknown as RequestContext,
      fakeTenantDataSource(),
    );
  });

  describe('create', () => {
    it('creates a non-system role with validated permissions', async () => {
      roleRepo.findByName.mockResolvedValue(null);

      const result = await service.create({
        name: 'coach',
        permissions: [PERMISSIONS.STUDENTS_READ, PERMISSIONS.STUDENTS_READ],
      });

      expect(result.isSystem).toBe(false);
      // duplicate permission keys are de-duplicated
      expect(result.permissions).toEqual([PERMISSIONS.STUDENTS_READ]);
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
        service.create({ name: 'coach', permissions: ['students:fly'] }),
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
        makeRole({ name: 'principal', isSystem: true }),
      );

      const result = await service.update('role-1', {
        permissions: [PERMISSIONS.STUDENTS_READ, PERMISSIONS.CLASSES_READ],
      });

      expect(result.permissions).toEqual([
        PERMISSIONS.STUDENTS_READ,
        PERMISSIONS.CLASSES_READ,
      ]);
    });

    it('keeps guardian and student roles to portal permissions', async () => {
      roleRepo.findByIdOrFail.mockResolvedValue(
        makeRole({
          name: 'guardian',
          isSystem: true,
          permissions: [PERMISSIONS.PORTAL_ACCESS],
        }),
      );

      await expect(
        service.update('role-1', { permissions: [PERMISSIONS.STUDENTS_READ] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('never mixes portal and staff permissions in one role', async () => {
      roleRepo.findByName.mockResolvedValue(null);

      await expect(
        service.create({
          name: 'odd',
          permissions: [PERMISSIONS.PORTAL_ACCESS, PERMISSIONS.STUDENTS_READ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('locks the scope of a system role', async () => {
      roleRepo.findByIdOrFail.mockResolvedValue(
        makeRole({
          name: 'teacher',
          isSystem: true,
          scope: RoleScope.ASSIGNED,
        }),
      );

      await expect(
        service.update('role-1', { scope: RoleScope.SCHOOL }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('locks the permissions of the admin role', async () => {
      roleRepo.findByIdOrFail.mockResolvedValue(
        makeRole({ name: ADMIN_ROLE_NAME, isSystem: true }),
      );

      await expect(
        service.update('role-1', { permissions: [PERMISSIONS.STUDENTS_READ] }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('no escalation', () => {
    beforeEach(() => {
      actor = { userId: 'actor', isAdmin: false };
      held = new Map([
        [PERMISSIONS.ROLES_MANAGE, RoleScope.SCHOOL],
        [PERMISSIONS.ROLES_ASSIGN, RoleScope.SCHOOL],
        [PERMISSIONS.STUDENTS_READ, RoleScope.SCHOOL],
        [PERMISSIONS.CLASSES_READ, RoleScope.ASSIGNED],
      ]);
      roleRepo.findByName.mockResolvedValue(null);
    });

    it('lets a non-admin create a role only from keys they hold', async () => {
      await expect(
        service.create({
          name: 'ok',
          permissions: [PERMISSIONS.STUDENTS_READ],
        }),
      ).resolves.toBeDefined();

      await expect(
        service.create({
          name: 'too-much',
          permissions: [PERMISSIONS.STUDENTS_DELETE],
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('needs school-wide reach to grant a key school-wide', async () => {
      await expect(
        service.create({
          name: 'wide',
          permissions: [PERMISSIONS.CLASSES_READ],
          scope: RoleScope.SCHOOL,
        }),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.create({
          name: 'narrow',
          permissions: [PERMISSIONS.CLASSES_READ],
          scope: RoleScope.ASSIGNED,
        }),
      ).resolves.toBeDefined();
    });

    it('refuses to add keys the actor lacks to an existing role', async () => {
      roleRepo.findByIdOrFail.mockResolvedValue(makeRole());

      await expect(
        service.update('role-1', {
          permissions: [PERMISSIONS.STUDENTS_READ, PERMISSIONS.USERS_CREATE],
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(roleRepo.save).not.toHaveBeenCalled();
    });

    it('refuses to clone a role that reaches further than the actor', async () => {
      roleRepo.findByIdOrFail.mockResolvedValue(
        makeRole({ permissions: [PERMISSIONS.USERS_DELETE] }),
      );

      await expect(service.clone('role-1', { name: 'copy' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('refuses to give or take away a role the actor could not grant', async () => {
      roleRepo.findByIdOrFail.mockResolvedValue(
        makeRole({
          name: ADMIN_ROLE_NAME,
          permissions: [PERMISSIONS.USERS_DELETE],
        }),
      );

      await expect(service.assignRole('u-1', 'role-1')).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.unassignRole('u-1', 'role-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(userRoleRepo.assign).not.toHaveBeenCalled();
      expect(userRoleRepo.unassign).not.toHaveBeenCalled();
    });

    it('lets school admins and system work (no signed-in user) grant anything', async () => {
      actor = { userId: 'actor', isAdmin: true };
      await expect(
        service.create({ name: 'a', permissions: [PERMISSIONS.USERS_DELETE] }),
      ).resolves.toBeDefined();

      actor = { userId: null, isAdmin: false };
      await expect(
        service.create({ name: 'b', permissions: [PERMISSIONS.USERS_DELETE] }),
      ).resolves.toBeDefined();
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
      userRoleRepo.findByRoleId.mockResolvedValue([
        { userId: 'a' },
        { userId: 'b' },
      ]);

      await expect(service.remove('role-1')).rejects.toThrow(ConflictException);
      expect(roleRepo.deleteById).not.toHaveBeenCalled();
    });

    it('deletes an assigned role when force is set', async () => {
      roleRepo.findByIdOrFail.mockResolvedValue(makeRole());
      userRoleRepo.findByRoleId.mockResolvedValue([
        { userId: 'a' },
        { userId: 'b' },
      ]);

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
      userRoleRepo.findAssignment.mockResolvedValue({ id: 'ur-1' });

      await service.unassignRole('u1', 'admin-role');

      expect(userRoleRepo.unassign).toHaveBeenCalledWith('u1', 'admin-role');
    });
  });

  describe('assignRole', () => {
    it('assigns an existing role', async () => {
      roleRepo.findByIdOrFail.mockResolvedValue(makeRole());

      await service.assignRole('u-1', 'role-1');

      expect(userRoleRepo.assign).toHaveBeenCalledWith('u-1', 'role-1');
    });

    it('rejects an unknown role', async () => {
      roleRepo.findByIdOrFail.mockRejectedValue(new NotFoundException());

      await expect(service.assignRole('u-1', 'nope')).rejects.toThrow(
        NotFoundException,
      );
      expect(userRoleRepo.assign).not.toHaveBeenCalled();
    });
  });

  describe('effectivePermissions', () => {
    it("lists the member's keys, sorted, without retired ones", async () => {
      held = new Map([
        [PERMISSIONS.STUDENTS_READ, RoleScope.SCHOOL],
        ['retired:key', RoleScope.SCHOOL],
        [PERMISSIONS.ATTENDANCE_TAKE, RoleScope.ASSIGNED],
      ]);

      await expect(service.effectivePermissions('u-1', false)).resolves.toEqual(
        [PERMISSIONS.ATTENDANCE_TAKE, PERMISSIONS.STUDENTS_READ].sort(),
      );
    });

    it('gives a school admin the whole catalog', async () => {
      const keys = await service.effectivePermissions('u-1', true);

      expect(keys).toEqual([...ALL_PERMISSIONS].sort());
    });
  });

  describe('audit log', () => {
    it('records a created role with its permissions', async () => {
      roleRepo.findByName.mockResolvedValue(null);

      await service.create({
        name: 'coach',
        permissions: [PERMISSIONS.STUDENTS_READ],
      });

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'role.created',
          entityType: 'role',
          entityId: 'new-role',
          before: null,
          after: like({
            name: 'coach',
            permissions: [PERMISSIONS.STUDENTS_READ],
          }),
        }),
      );
    });

    it('records the permissions before and after an update', async () => {
      roleRepo.findByIdOrFail.mockResolvedValue(makeRole());

      await service.setPermissions('role-1', [PERMISSIONS.CLASSES_READ]);

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'role.updated',
          before: like({
            permissions: [PERMISSIONS.STUDENTS_READ],
          }),
          after: like({
            permissions: [PERMISSIONS.CLASSES_READ],
          }),
        }),
      );
    });

    it('records a deleted role with the users who held it', async () => {
      roleRepo.findByIdOrFail.mockResolvedValue(makeRole());
      userRoleRepo.findByRoleId.mockResolvedValue([{ userId: 'u1' }]);

      await service.remove('role-1', true);

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'role.deleted',
          before: like({ holderUserIds: ['u1'] }),
        }),
      );
    });

    it('records a new assignment but not a repeated one', async () => {
      roleRepo.findByIdOrFail.mockResolvedValue(makeRole());
      userRoleRepo.findAssignment.mockResolvedValueOnce(null);

      await service.assignRole('u1', 'role-1');
      userRoleRepo.findAssignment.mockResolvedValueOnce({ id: 'ur-1' });
      await service.assignRole('u1', 'role-1');

      expect(userRoleRepo.assign).toHaveBeenCalledTimes(1);
      expect(audit.record).toHaveBeenCalledTimes(1);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'role.assigned',
          entityType: 'user',
          entityId: 'u1',
          after: { roleId: 'role-1', roleName: 'teacher' },
        }),
      );
    });

    it('does not record removing a role the user does not hold', async () => {
      roleRepo.findByIdOrFail.mockResolvedValue(makeRole());
      userRoleRepo.findAssignment.mockResolvedValue(null);

      await service.unassignRole('u1', 'role-1');

      expect(userRoleRepo.unassign).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });
  });

  describe('clone', () => {
    it('copies permissions and scope into a new custom role', async () => {
      roleRepo.findByIdOrFail.mockResolvedValue(
        makeRole({
          name: 'principal',
          description: 'Runs academics',
          isSystem: true,
          scope: RoleScope.ASSIGNED,
          permissions: [PERMISSIONS.STUDENTS_READ, 'retired:key'],
        }),
      );
      roleRepo.findByName.mockResolvedValue(null);

      const result = await service.clone('role-1', { name: 'vice_principal' });

      expect(result).toMatchObject({
        name: 'vice_principal',
        description: 'Runs academics',
        isSystem: false,
        scope: RoleScope.ASSIGNED,
        // keys no longer in the catalog are dropped
        permissions: [PERMISSIONS.STUDENTS_READ],
      });
    });

    it('rejects a name that is already taken', async () => {
      roleRepo.findByIdOrFail.mockResolvedValue(makeRole());
      roleRepo.findByName.mockResolvedValue(makeRole({ id: 'other' }));

      await expect(
        service.clone('role-1', { name: 'teacher' }),
      ).rejects.toThrow(ConflictException);
      expect(roleRepo.saveNew).not.toHaveBeenCalled();
    });
  });

  describe('findSystemRole', () => {
    it('returns a seeded system role by name', async () => {
      roleRepo.findByName.mockResolvedValue(makeRole({ name: 'student' }));

      await expect(service.findSystemRole('student')).resolves.toMatchObject({
        name: 'student',
      });
    });

    it('rejects when the system role is not seeded', async () => {
      roleRepo.findByName.mockResolvedValue(null);

      await expect(service.findSystemRole('student')).rejects.toThrow(
        'System role "student" is not seeded for this tenant',
      );
    });
  });

  describe('no-op update', () => {
    it('neither saves nor records an update that changes nothing', async () => {
      roleRepo.findByIdOrFail.mockResolvedValue(
        makeRole({
          description: 'Teaches',
          permissions: [PERMISSIONS.STUDENTS_READ, PERMISSIONS.CLASSES_READ],
        }),
      );

      await service.update('role-1', {
        name: 'teacher',
        description: 'Teaches',
        // Same keys, another order.
        permissions: [PERMISSIONS.CLASSES_READ, PERMISSIONS.STUDENTS_READ],
        scope: RoleScope.SCHOOL,
      });

      expect(roleRepo.save).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('still records a real change', async () => {
      roleRepo.findByIdOrFail.mockResolvedValue(makeRole());

      await service.update('role-1', { description: 'Teaches' });

      expect(roleRepo.save).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'role.updated' }),
      );
    });
  });
});
