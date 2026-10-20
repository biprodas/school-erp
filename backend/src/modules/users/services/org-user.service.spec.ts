import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { MembershipStatus } from '~/modules/memberships/enums/membership-status.enum';
import { AuditService } from '~/modules/audit/services/audit.service';
import { RoleService } from '~/modules/rbac/services/role.service';
import { fakeTenantDataSource } from '~/tenancy/tenant-datasource.testing';
import { SessionService } from '~/modules/auth/services/session.service';
import type { RequestContext } from '~/shared/request-context/request-context.service';
import { UserStatus } from '../enums/user-status.enum';
import { AccountRepository } from '../repositories/account.repository';
import { MemberRepository } from '../repositories/member.repository';
import { OrgUserService } from './org-user.service';

describe('OrgUserService', () => {
  let service: OrgUserService;
  let accountRepo: Record<string, jest.Mock>;
  let memberRepo: Record<string, jest.Mock>;
  let roleService: Record<string, jest.Mock>;
  let audit: { record: jest.Mock };
  let sessions: { revokeAllForUserInOrg: jest.Mock };
  /** Whether the signed-in user is a school admin. */
  let actorIsAdmin: boolean;

  beforeEach(() => {
    actorIsAdmin = true;
    sessions = { revokeAllForUserInOrg: jest.fn() };
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
    accountRepo.save = jest.fn((a: unknown) => Promise.resolve(a));
    roleService = {
      assignRole: jest.fn(),
      findAssignable: jest.fn(),
      assertCanManageRoles: jest.fn(),
    };
    audit = { record: jest.fn() };
    const context = {
      current: () => ({ userId: 'actor', isAdmin: actorIsAdmin }),
    };
    service = new OrgUserService(
      accountRepo as unknown as AccountRepository,
      memberRepo as unknown as MemberRepository,
      roleService as unknown as RoleService,
      audit as unknown as AuditService,
      context as unknown as RequestContext,
      sessions as unknown as SessionService,
      fakeTenantDataSource('org-1'),
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

  describe('audit log', () => {
    const member = () => ({
      id: 'm-1',
      userId: 'u-1',
      isAdmin: false,
      status: MembershipStatus.ACTIVE,
      user: { id: 'u-1', name: 'Rahim', email: null, phone: null },
    });

    beforeEach(() => {
      memberRepo.save = jest.fn((m: unknown) => Promise.resolve(m));
      roleService.findAssignments = jest.fn().mockResolvedValue([]);
      roleService.getUserRoles = jest
        .fn()
        .mockResolvedValue([{ id: 'r-1', name: 'teacher' }]);
      roleService.unassignAll = jest.fn();
      memberRepo.deleteById = jest.fn();
    });

    it('records granting school-admin rights, once', async () => {
      memberRepo.findByUserId.mockResolvedValue(member());

      await service.grantAdmin('u-1');

      expect(audit.record).toHaveBeenCalledWith({
        action: 'member.admin_granted',
        entityType: 'user',
        entityId: 'u-1',
        before: { isAdmin: false },
        after: { isAdmin: true },
      });

      audit.record.mockClear();
      memberRepo.findByUserId.mockResolvedValue({ ...member(), isAdmin: true });
      await service.grantAdmin('u-1');
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('ends the sessions of a member who leaves or loses admin rights', async () => {
      memberRepo.findByUserId.mockResolvedValue(member());
      await service.remove('u-1');
      expect(sessions.revokeAllForUserInOrg).toHaveBeenCalledWith(
        'u-1',
        'org-1',
      );

      sessions.revokeAllForUserInOrg.mockClear();
      memberRepo.findByUserId.mockResolvedValue({ ...member(), isAdmin: true });
      await service.revokeAdmin('u-1');
      expect(sessions.revokeAllForUserInOrg).toHaveBeenCalledWith(
        'u-1',
        'org-1',
      );

      sessions.revokeAllForUserInOrg.mockClear();
      memberRepo.findByUserId.mockResolvedValue(member());
      await service.update('u-1', { status: MembershipStatus.SUSPENDED });
      expect(sessions.revokeAllForUserInOrg).toHaveBeenCalledWith(
        'u-1',
        'org-1',
      );
    });

    it('keeps the sessions for a rename', async () => {
      memberRepo.findByUserId.mockResolvedValue(member());
      await service.update('u-1', { name: 'Rahim Uddin' });
      expect(sessions.revokeAllForUserInOrg).not.toHaveBeenCalled();
    });

    it('lets only a school admin change or remove a school admin', async () => {
      actorIsAdmin = false;
      memberRepo.findByUserId.mockResolvedValue({ ...member(), isAdmin: true });

      await expect(service.remove('u-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(
        service.update('u-1', { status: MembershipStatus.SUSPENDED }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(memberRepo.deleteById).not.toHaveBeenCalled();
    });

    it('checks the actor may manage the roles of the member they remove', async () => {
      memberRepo.findByUserId.mockResolvedValue(member());
      roleService.assertCanManageRoles.mockRejectedValue(
        new ForbiddenException(),
      );

      await expect(service.remove('u-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(roleService.unassignAll).not.toHaveBeenCalled();
    });

    it('records a removed member with the roles they held', async () => {
      memberRepo.findByUserId.mockResolvedValue(member());

      await service.remove('u-1');

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'member.removed',
          entityId: 'u-1',
          before: {
            status: MembershipStatus.ACTIVE,
            isAdmin: false,
            roles: [{ id: 'r-1', name: 'teacher' }],
          },
        }),
      );
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

    it('resets an unverified registered account instead of linking its password', async () => {
      const pending = {
        id: 'u-1',
        email: 'rina@school.test',
        password: 'chosen-by-whoever-registered',
        status: UserStatus.PENDING,
      };
      accountRepo.findByEmail.mockResolvedValue(pending);

      const result = await service.addMember({
        ...base,
        email: 'rina@school.test',
      });

      expect(result).toMatchObject({ userId: 'u-1', createdAccount: true });
      expect(accountRepo.save).toHaveBeenCalled();
      expect(pending.password).not.toBe('chosen-by-whoever-registered');
      // No temporary password: it stays pending until the activation link.
      expect(pending.status).toBe(UserStatus.PENDING);
    });

    it('activates an unverified account given a temporary password by the school', async () => {
      const pending = {
        id: 'u-1',
        phone: '+8801712345678',
        password: 'x',
        status: UserStatus.PENDING,
      };
      accountRepo.findByPhone.mockResolvedValue(pending);

      await service.addMember({
        ...base,
        phone: '01712345678',
        password: 'Temp-pass1',
      });

      expect(pending).toMatchObject({
        status: UserStatus.ACTIVE,
        mustChangePassword: true,
      });
    });

    it('checks every requested role is one the actor may give', async () => {
      roleService.findAssignable.mockRejectedValue(new ForbiddenException());

      await expect(
        service.addMember({ ...base, email: 'a@b.test', roleIds: ['admin'] }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(accountRepo.saveNew).not.toHaveBeenCalled();
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
