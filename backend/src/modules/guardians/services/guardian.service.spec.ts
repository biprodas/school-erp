import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { RoleService } from '~/modules/rbac/services/role.service';
import { StudentService } from '~/modules/students/services/student.service';
import { OrgUserService } from '~/modules/users/services/org-user.service';
import { Guardian } from '../entities/guardian.entity';
import { StudentGuardian } from '../entities/student-guardian.entity';
import { GuardianRelation } from '../enums/guardian-relation.enum';
import { GuardianRepository } from '../repositories/guardian.repository';
import { GuardianService } from './guardian.service';
import { StudentGuardianRepository } from '../repositories/student-guardian.repository';
import { fakeTenantDataSource } from '~/tenancy/tenant-datasource.testing';

const makeGuardian = (overrides: Partial<Guardian> = {}): Guardian => ({
  id: 'g-1',
  orgId: 'org-1',
  name: 'John Roe',
  phone: null,
  email: null,
  address: null,
  userId: null,
  links: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeLink = (overrides: Partial<StudentGuardian> = {}): StudentGuardian =>
  ({
    id: 'l-1',
    studentId: 'stu-1',
    guardianId: 'g-1',
    relation: GuardianRelation.FATHER,
    isPrimary: false,
    isEmergency: false,
    createdAt: new Date(),
    ...overrides,
  }) as StudentGuardian;

describe('GuardianService', () => {
  let service: GuardianService;
  let guardianRepo: Record<string, jest.Mock>;
  let linkRepo: Record<string, jest.Mock>;
  let userService: Record<string, jest.Mock>;
  let roleService: Record<string, jest.Mock>;
  let studentService: Record<string, jest.Mock>;

  beforeEach(() => {
    guardianRepo = {
      findByIdWithUser: jest.fn(),
      findByUserId: jest.fn(),
      findFiltered: jest.fn(),
      saveNew: jest.fn((data: Partial<Guardian>) =>
        Promise.resolve(makeGuardian({ id: 'new-g', ...data })),
      ),
      save: jest.fn((entity) => Promise.resolve(entity)),
      deleteById: jest.fn(),
    };
    linkRepo = {
      findByStudent: jest.fn(),
      findLink: jest.fn(),
      clearPrimary: jest.fn(),
      findByIdOrFail: jest.fn(),
      saveNew: jest.fn((data: Partial<StudentGuardian>) =>
        Promise.resolve(makeLink({ id: 'new-l', ...data })),
      ),
      save: jest.fn((entity) => Promise.resolve(entity)),
      deleteById: jest.fn(),
      deleteByGuardian: jest.fn(),
    };
    userService = { findById: jest.fn(), create: jest.fn() };
    roleService = { findSystemRole: jest.fn() };
    studentService = { findById: jest.fn() };

    service = new GuardianService(
      guardianRepo as unknown as GuardianRepository,
      linkRepo as unknown as StudentGuardianRepository,
      userService as unknown as OrgUserService,
      roleService as unknown as RoleService,
      studentService as unknown as StudentService,
      fakeTenantDataSource(),
    );
  });

  describe('create', () => {
    it('creates a guardian with no user link', async () => {
      guardianRepo.findByIdWithUser.mockResolvedValue(
        makeGuardian({ id: 'new-g' }),
      );

      const result = await service.create({ name: 'John Roe' });

      expect(result.id).toBe('new-g');
      expect(guardianRepo.saveNew).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'John Roe', userId: null }),
      );
      expect(userService.create).not.toHaveBeenCalled();
    });

    it('provisions a new user with the parent role when createUser is set', async () => {
      roleService.findSystemRole.mockResolvedValue({ id: 'role-guardian' });
      userService.create.mockResolvedValue({ id: 'new-user' });
      guardianRepo.findByIdWithUser.mockResolvedValue(
        makeGuardian({ id: 'new-g', userId: 'new-user' }),
      );

      const result = await service.create({
        name: 'Jane Roe',
        createUser: { email: 'jane@example.com', password: 'secret123' },
      });

      expect(roleService.findSystemRole).toHaveBeenCalledWith('guardian');
      expect(userService.create).toHaveBeenCalledWith({
        name: 'Jane Roe',
        email: 'jane@example.com',
        password: 'secret123',
        roleIds: ['role-guardian'],
      });
      expect(result.userId).toBe('new-user');
    });

    it('rejects when the parent system role is missing', async () => {
      roleService.findSystemRole.mockRejectedValue(new NotFoundException());

      await expect(
        service.create({
          name: 'X',
          createUser: { email: 'x@y.com', password: 'secret123' },
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects when both userId and createUser are provided', async () => {
      await expect(
        service.create({
          name: 'X',
          userId: 'user-1',
          createUser: { email: 'a@b.com', password: 'secret123' },
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('attach', () => {
    it('links an existing guardian to a student', async () => {
      studentService.findById.mockResolvedValue({ id: 'stu-1' });
      guardianRepo.findByIdWithUser.mockResolvedValue(makeGuardian());
      linkRepo.findLink.mockResolvedValue(null);
      linkRepo.findByIdOrFail.mockResolvedValue(
        makeLink({ id: 'new-l', relation: GuardianRelation.FATHER }),
      );

      const result = await service.attach('stu-1', {
        guardianId: 'g-1',
        relation: GuardianRelation.FATHER,
      });

      expect(linkRepo.saveNew).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: 'stu-1',
          guardianId: 'g-1',
          relation: GuardianRelation.FATHER,
          isPrimary: false,
        }),
      );
      expect(result.id).toBe('new-l');
      expect(linkRepo.clearPrimary).not.toHaveBeenCalled();
    });

    it('clears other primaries when attaching a primary guardian', async () => {
      studentService.findById.mockResolvedValue({ id: 'stu-1' });
      guardianRepo.findByIdWithUser.mockResolvedValue(makeGuardian());
      linkRepo.findLink.mockResolvedValue(null);
      linkRepo.findByIdOrFail.mockResolvedValue(makeLink({ isPrimary: true }));

      await service.attach('stu-1', {
        guardianId: 'g-1',
        relation: GuardianRelation.OTHER,
        isPrimary: true,
      });

      expect(linkRepo.clearPrimary).toHaveBeenCalledWith('stu-1');
    });

    it('creates a guardian inline when createGuardian is provided', async () => {
      studentService.findById.mockResolvedValue({ id: 'stu-1' });
      linkRepo.findByIdOrFail.mockResolvedValue(makeLink({ id: 'new-l' }));

      await service.attach('stu-1', {
        createGuardian: { name: 'New Mom' },
        relation: GuardianRelation.MOTHER,
      });

      expect(guardianRepo.saveNew).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Mom' }),
      );
      expect(linkRepo.saveNew).toHaveBeenCalledWith(
        expect.objectContaining({ guardianId: 'new-g' }),
      );
    });

    it('rejects a duplicate link', async () => {
      studentService.findById.mockResolvedValue({ id: 'stu-1' });
      guardianRepo.findByIdWithUser.mockResolvedValue(makeGuardian());
      linkRepo.findLink.mockResolvedValue(makeLink());

      await expect(
        service.attach('stu-1', {
          guardianId: 'g-1',
          relation: GuardianRelation.FATHER,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects when neither guardianId nor createGuardian is provided', async () => {
      studentService.findById.mockResolvedValue({ id: 'stu-1' });

      await expect(
        service.attach('stu-1', { relation: GuardianRelation.OTHER }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateLink', () => {
    it('clears other primaries when promoting a link to primary', async () => {
      linkRepo.findByIdOrFail
        .mockResolvedValueOnce(makeLink({ id: 'l-1', isPrimary: false }))
        .mockResolvedValueOnce(makeLink({ id: 'l-1', isPrimary: true }));

      const result = await service.updateLink('stu-1', 'l-1', {
        isPrimary: true,
      });

      expect(linkRepo.clearPrimary).toHaveBeenCalledWith('stu-1');
      expect(result.isPrimary).toBe(true);
    });

    it('rejects a link that belongs to another student', async () => {
      linkRepo.findByIdOrFail.mockResolvedValue(
        makeLink({ id: 'l-1', studentId: 'other' }),
      );

      await expect(
        service.updateLink('stu-1', 'l-1', { isEmergency: true }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('detach', () => {
    it('removes a link after verifying ownership', async () => {
      linkRepo.findByIdOrFail.mockResolvedValue(makeLink({ id: 'l-1' }));

      await service.detach('stu-1', 'l-1');

      expect(linkRepo.deleteById).toHaveBeenCalledWith('l-1');
    });
  });

  describe('remove', () => {
    it('unlinks the guardian from their students, then deletes them', async () => {
      jest
        .spyOn(service, 'findById')
        .mockResolvedValue({ id: 'g-1' } as Guardian);

      await service.remove('g-1');

      expect(linkRepo.deleteByGuardian).toHaveBeenCalledWith('g-1');
      expect(guardianRepo.deleteById).toHaveBeenCalledWith('g-1');
    });
  });
});
