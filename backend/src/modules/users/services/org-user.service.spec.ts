import { NotFoundException } from '@nestjs/common';
import { RoleService } from '~/modules/rbac/services/role.service';
import { fakeTenantDataSource } from '~/tenancy/tenant-datasource.testing';
import { AccountRepository } from '../repositories/account.repository';
import { MemberRepository } from '../repositories/member.repository';
import { OrgUserService } from './org-user.service';

describe('OrgUserService', () => {
  let service: OrgUserService;
  let memberRepo: Record<string, jest.Mock>;
  let roleService: Record<string, jest.Mock>;

  beforeEach(() => {
    memberRepo = { findByUserId: jest.fn() };
    roleService = { assignRole: jest.fn() };
    service = new OrgUserService(
      {} as AccountRepository,
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
});
