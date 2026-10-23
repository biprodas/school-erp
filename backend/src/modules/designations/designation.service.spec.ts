import { ConflictException, NotFoundException } from '@nestjs/common';
import { RoleService } from '~/modules/rbac/services/role.service';
import { DesignationRepository } from './designation.repository';
import { DesignationService } from './designation.service';
import { Designation } from './entities/designation.entity';

const makeDesignation = (
  overrides: Partial<Designation> = {},
): Designation => ({
  id: 'desig-1',
  orgId: 'org-1',
  title: 'Head Teacher',
  description: null,
  defaultRoleId: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('DesignationService', () => {
  let service: DesignationService;
  let designationRepo: Record<string, jest.Mock>;
  let roleService: { findAssignable: jest.Mock };

  beforeEach(() => {
    designationRepo = {
      findByTitle: jest.fn(),
      findFiltered: jest.fn(),
      findByIdOrFail: jest.fn(),
      saveNew: jest.fn((data: Partial<Designation>) =>
        Promise.resolve(makeDesignation({ id: 'new-desig', ...data })),
      ),
      save: jest.fn((entity) => Promise.resolve(entity)),
      deleteById: jest.fn(),
    };

    roleService = {
      findAssignable: jest.fn().mockResolvedValue({
        id: 'role-teacher',
        permissions: ['students:read'],
      }),
    };

    service = new DesignationService(
      designationRepo as unknown as DesignationRepository,
      roleService as unknown as RoleService,
    );
  });

  describe('default role', () => {
    it('accepts a staff role the user may assign', async () => {
      designationRepo.findByTitle.mockResolvedValue(null);

      await service.create({ title: 'Teacher', defaultRoleId: 'role-teacher' });

      expect(roleService.findAssignable).toHaveBeenCalledWith('role-teacher');
      expect(designationRepo.saveNew).toHaveBeenCalledWith(
        expect.objectContaining({ defaultRoleId: 'role-teacher' }),
      );
    });

    it('rejects a portal role', async () => {
      designationRepo.findByTitle.mockResolvedValue(null);
      roleService.findAssignable.mockResolvedValue({
        id: 'role-guardian',
        permissions: ['portal:access'],
      });

      await expect(
        service.create({ title: 'Parent', defaultRoleId: 'role-guardian' }),
      ).rejects.toMatchObject({ response: { code: 'NOT_A_STAFF_ROLE' } });
    });
  });

  describe('create', () => {
    it('creates a designation with defaults', async () => {
      designationRepo.findByTitle.mockResolvedValue(null);

      const result = await service.create({ title: 'Head Teacher' });

      expect(designationRepo.saveNew).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Head Teacher',
          description: null,
          isActive: true,
        }),
      );
      expect(result.id).toBe('new-desig');
    });

    it('rejects a duplicate title', async () => {
      designationRepo.findByTitle.mockResolvedValue(makeDesignation());

      await expect(service.create({ title: 'Head Teacher' })).rejects.toThrow(
        ConflictException,
      );
      expect(designationRepo.saveNew).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('rejects a title already used by another designation', async () => {
      designationRepo.findByIdOrFail.mockResolvedValue(
        makeDesignation({ id: 'desig-1', title: 'Head Teacher' }),
      );
      designationRepo.findByTitle.mockResolvedValue(
        makeDesignation({ id: 'desig-2', title: 'Senior Clerk' }),
      );

      await expect(
        service.update('desig-1', { title: 'Senior Clerk' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('deletes after verifying existence', async () => {
      designationRepo.findByIdOrFail.mockResolvedValue(makeDesignation());

      await service.remove('desig-1');

      expect(designationRepo.deleteById).toHaveBeenCalledWith('desig-1');
    });

    it('propagates not-found from the repository', async () => {
      designationRepo.findByIdOrFail.mockRejectedValue(new NotFoundException());

      await expect(service.remove('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
