import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { MembershipStatus } from '~/modules/memberships/enums/membership-status.enum';
import { RoleService } from '~/modules/rbac/services/role.service';
import { fakeTenantDataSource } from '~/tenancy/tenant-datasource.testing';
import { AccountRepository } from '../repositories/account.repository';
import { MemberRepository } from '../repositories/member.repository';
import { OrgUserService } from './org-user.service';

describe('OrgUserService', () => {
  let service: OrgUserService;
  let accountRepo: Record<string, jest.Mock>;
  let memberRepo: Record<string, jest.Mock>;
  let roleService: Record<string, jest.Mock>;

  beforeEach(() => {
    accountRepo = {
      findByEmail: jest.fn().mockResolvedValue(null),
      findByPhone: jest.fn().mockResolvedValue(null),
      saveNew: jest.fn((data: object) =>
        Promise.resolve({ id: 'u-new', ...data }),
      ),
    };
    memberRepo = {
      findByUserId: jest.fn().mockResolvedValue(null),
      saveNew: jest.fn(),
    };
    roleService = { assignRole: jest.fn(), findById: jest.fn() };
    service = new OrgUserService(
      accountRepo as unknown as AccountRepository,
      memberRepo as unknown as MemberRepository,
      roleService as unknown as RoleService,
      fakeTenantDataSource(),
    );
  });

  describe('assignRole', () => {
    it('assigns the role to a member of this organization', async () => {
      memberRepo.findByUserId.mockResolvedValue({ id: 'm-1', userId: 'u-1' });

      await service.assignRole('u-1', 'role-1');

      expect(memberRepo.findByUserId).toHaveBeenCalledWith('u-1');
      expect(roleService.assignRole).toHaveBeenCalledWith('u-1', 'role-1');
    });

    it('rejects users who are not members of this organization', async () => {
      memberRepo.findByUserId.mockResolvedValue(null);

      await expect(service.assignRole('stranger', 'role-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(roleService.assignRole).not.toHaveBeenCalled();
    });
  });

  describe('addMember', () => {
    const base = { name: 'Rina', status: MembershipStatus.ACTIVE };

    it('creates a phone-only account with a temporary password that must be changed', async () => {
      const result = await service.addMember({
        ...base,
        phone: '01712-345678',
        password: 'Temp-pass1',
        roleIds: ['role-1'],
      });

      const [[created]] = accountRepo.saveNew.mock.calls as [
        [
          {
            email: string | null;
            phone: string;
            password: string;
            mustChangePassword: boolean;
          },
        ],
      ];
      expect(created).toMatchObject({
        email: null,
        phone: '+8801712345678',
        mustChangePassword: true,
      });
      await expect(
        bcrypt.compare('Temp-pass1', created.password),
      ).resolves.toBe(true);
      expect(memberRepo.saveNew).toHaveBeenCalledWith({
        userId: 'u-new',
        status: MembershipStatus.ACTIVE,
      });
      expect(roleService.assignRole).toHaveBeenCalledWith('u-new', 'role-1');
      expect(result.createdAccount).toBe(true);
    });

    it('gives a new invited account an unusable password and no forced change', async () => {
      await service.addMember({ ...base, email: 'Rina@School.test' });

      expect(accountRepo.saveNew).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'rina@school.test',
          mustChangePassword: false,
        }),
      );
    });

    it('links an existing account without touching its password', async () => {
      accountRepo.findByEmail.mockResolvedValue({
        id: 'u-1',
        email: 'rina@school.test',
      });

      const result = await service.addMember({
        ...base,
        email: 'rina@school.test',
        password: 'ignored',
      });

      expect(accountRepo.saveNew).not.toHaveBeenCalled();
      expect(result).toMatchObject({ userId: 'u-1', createdAccount: false });
    });

    it('refuses an email and a phone that belong to different accounts', async () => {
      accountRepo.findByEmail.mockResolvedValue({ id: 'u-1' });
      accountRepo.findByPhone.mockResolvedValue({ id: 'u-2' });

      await expect(
        service.addMember({ ...base, email: 'a@b.test', phone: '01712345678' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('refuses someone who is already a member', async () => {
      accountRepo.findByPhone.mockResolvedValue({ id: 'u-1' });
      memberRepo.findByUserId.mockResolvedValue({ id: 'm-1' });

      await expect(
        service.addMember({ ...base, phone: '01712345678' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('requires an email or a valid phone number', async () => {
      await expect(service.addMember({ ...base })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(
        service.addMember({ ...base, phone: '12345' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
