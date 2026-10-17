import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { RoleRepository } from '../rbac/role.repository';
import { OrgUserService } from '../users/services/org-user.service';
import { StakeholderRepository } from './stakeholder.repository';
import { StakeholderService } from './stakeholder.service';
import { Stakeholder } from './entities/stakeholder.entity';
import { StakeholderStatus } from './enums/stakeholder-status.enum';
import { StakeholderType } from './enums/stakeholder-type.enum';

const makeStakeholder = (
  overrides: Partial<Stakeholder> = {},
): Stakeholder => ({
  id: 'stk-1',
  orgId: 'org-1',
  name: 'Acme Supplies',
  type: StakeholderType.VENDOR,
  organization: null,
  email: null,
  phone: null,
  address: null,
  notes: null,
  status: StakeholderStatus.ACTIVE,
  userId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('StakeholderService', () => {
  let service: StakeholderService;
  let stakeholderRepo: Record<string, jest.Mock>;
  let userService: Record<string, jest.Mock>;
  let roleRepo: Record<string, jest.Mock>;

  beforeEach(() => {
    stakeholderRepo = {
      findByIdWithUser: jest.fn(),
      findByUserId: jest.fn(),
      findFiltered: jest.fn(),
      saveNew: jest.fn((data) =>
        Promise.resolve(makeStakeholder({ id: 'new-stk', ...data })),
      ),
      save: jest.fn((entity) => Promise.resolve(entity)),
      deleteById: jest.fn(),
    };
    userService = {
      findById: jest.fn(),
      create: jest.fn(),
    };
    roleRepo = {
      findByName: jest.fn(),
    };

    service = new StakeholderService(
      stakeholderRepo as unknown as StakeholderRepository,
      userService as unknown as OrgUserService,
      roleRepo as unknown as RoleRepository,
    );
  });

  describe('create', () => {
    it('creates a stakeholder with no user link', async () => {
      stakeholderRepo.findByIdWithUser.mockResolvedValue(
        makeStakeholder({ id: 'new-stk' }),
      );

      const result = await service.create({
        name: 'Acme Supplies',
        type: StakeholderType.VENDOR,
      });

      expect(result.id).toBe('new-stk');
      expect(stakeholderRepo.saveNew).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Acme Supplies',
          type: StakeholderType.VENDOR,
          userId: null,
          status: StakeholderStatus.ACTIVE,
        }),
      );
      expect(userService.create).not.toHaveBeenCalled();
    });

    it('provisions a new user with the stakeholder role when createUser is set', async () => {
      roleRepo.findByName.mockResolvedValue({ id: 'role-stk' });
      userService.create.mockResolvedValue({ id: 'new-user' });
      stakeholderRepo.findByIdWithUser.mockResolvedValue(
        makeStakeholder({ id: 'new-stk', userId: 'new-user' }),
      );

      const result = await service.create({
        name: 'Jane Donor',
        type: StakeholderType.DONOR,
        createUser: { email: 'jane@example.com', password: 'secret123' },
      });

      expect(roleRepo.findByName).toHaveBeenCalledWith('stakeholder');
      expect(userService.create).toHaveBeenCalledWith({
        name: 'Jane Donor',
        email: 'jane@example.com',
        password: 'secret123',
        roleIds: ['role-stk'],
      });
      expect(result.userId).toBe('new-user');
    });

    it('rejects when both userId and createUser are provided', async () => {
      await expect(
        service.create({
          name: 'X',
          type: StakeholderType.OTHER,
          userId: 'user-1',
          createUser: { email: 'a@b.com', password: 'secret123' },
        }),
      ).rejects.toThrow(BadRequestException);
      expect(stakeholderRepo.saveNew).not.toHaveBeenCalled();
    });

    it('rejects when the stakeholder system role is missing', async () => {
      roleRepo.findByName.mockResolvedValue(null);

      await expect(
        service.create({
          name: 'X',
          type: StakeholderType.OTHER,
          createUser: { email: 'x@y.com', password: 'secret123' },
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects when the user is already linked to another stakeholder', async () => {
      userService.findById.mockResolvedValue({ id: 'user-7' });
      stakeholderRepo.findByUserId.mockResolvedValue(
        makeStakeholder({ id: 'other-stk' }),
      );

      await expect(
        service.create({
          name: 'X',
          type: StakeholderType.PARTNER,
          userId: 'user-7',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('deletes after verifying existence', async () => {
      stakeholderRepo.findByIdWithUser.mockResolvedValue(makeStakeholder());

      await service.remove('stk-1');

      expect(stakeholderRepo.deleteById).toHaveBeenCalledWith('stk-1');
    });
  });

  describe('findFiltered', () => {
    it('passes only provided filters to the repository', async () => {
      stakeholderRepo.findFiltered.mockResolvedValue([]);

      await service.findFiltered({ type: StakeholderType.VENDOR });

      expect(stakeholderRepo.findFiltered).toHaveBeenCalledWith({
        type: StakeholderType.VENDOR,
      });
    });
  });
});
