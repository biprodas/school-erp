import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PlatformAuditService } from '~/modules/audit/services/platform-audit.service';
import { SessionService } from '~/modules/auth/services/session.service';
import { MembershipService } from './membership.service';
import { Membership } from '../entities/membership.entity';
import { MembershipRole } from '../enums/membership-role.enum';
import { OrganizationService } from '~/modules/organizations/services/organization.service';
import { UserService } from '~/modules/users/services/user.service';
import { OwnerProvisioningService } from '~/modules/auth/services/owner-provisioning.service';
import { UserStatus } from '~/modules/users/enums/user-status.enum';
import { RequestContextDto } from '~/common/dto/request-context.dto';
import { UserRole } from '~/modules/rbac/entities/user-role.entity';

// --- Helpers ---

const makeCtx = (
  overrides: Partial<RequestContextDto> = {},
): RequestContextDto =>
  Object.assign(
    {
      requestId: 'test',
      ip: '127.0.0.1',
      protocol: 'http',
      host: 'localhost',
      url: '/test',
      orgId: null,
      userId: null,
      user: null,
    } as RequestContextDto,
    overrides,
  );

const superAdminCtx = () =>
  makeCtx({
    userId: 'admin-id',
    user: {
      id: 'admin-id',
      email: 'admin@test.com',
      status: UserStatus.ACTIVE,
      isAdmin: true,
    },
  });

const userCtx = (id = 'user-id') =>
  makeCtx({
    userId: id,
    user: {
      id,
      email: 'user@test.com',
      status: UserStatus.ACTIVE,
      isAdmin: false,
    },
  });

const TENANT_ID = 'org-1';

const makeMembership = (overrides: Partial<Membership> = {}): Membership =>
  ({
    id: 'mem-1',
    userId: 'user-id',
    orgId: TENANT_ID,
    role: MembershipRole.MEMBER,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Membership;

// --- Test suite ---

describe('MembershipService', () => {
  let service: MembershipService;
  let membershipRepo: Record<string, jest.Mock>;
  let tenantService: Record<string, jest.Mock>;
  let userService: Record<string, jest.Mock>;
  let ownerProvisioning: Record<string, jest.Mock>;
  let manager: Record<string, jest.Mock>;
  let platformAudit: { record: jest.Mock };
  const sessions = {
    revokeAllForUser: jest.fn(),
    revokeAllForUserInOrg: jest.fn(),
  };

  beforeEach(async () => {
    sessions.revokeAllForUser.mockClear();
    sessions.revokeAllForUserInOrg.mockClear();
    membershipRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((data: object) => ({ ...data })),
      save: jest.fn((entity) => Promise.resolve({ id: 'new-mem', ...entity })),
      delete: jest.fn(),
    };

    tenantService = {
      findById: jest.fn(),
    };

    userService = {
      findById: jest.fn(),
    };

    ownerProvisioning = {
      provisionOwner: jest
        .fn()
        .mockResolvedValue({ token: 'activation-token' }),
      sendActivationEmail: jest.fn(),
    };

    manager = {
      findOneOrFail: jest.fn((_: unknown, { where }: { where: Membership }) =>
        Promise.resolve(
          makeMembership({
            userId: where.userId,
            orgId: where.orgId,
            role: MembershipRole.OWNER,
            isAdmin: true,
          }),
        ),
      ),
      delete: jest.fn(),
      // Writes inside a transaction land on the same repository mock.
      create: jest.fn((_entity: unknown, data: object): unknown =>
        membershipRepo.create(data),
      ),
      save: jest.fn((entity: object): unknown => membershipRepo.save(entity)),
    };
    platformAudit = { record: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembershipService,
        { provide: getRepositoryToken(Membership), useValue: membershipRepo },
        {
          provide: getDataSourceToken(),
          useValue: {
            transaction: jest.fn((cb: (m: typeof manager) => unknown) =>
              Promise.resolve(cb(manager)),
            ),
          },
        },
        { provide: OrganizationService, useValue: tenantService },
        { provide: UserService, useValue: userService },
        { provide: OwnerProvisioningService, useValue: ownerProvisioning },
        { provide: PlatformAuditService, useValue: platformAudit },
        { provide: SessionService, useValue: sessions },
      ],
    }).compile();

    service = module.get<MembershipService>(MembershipService);
  });

  // ===================== create =====================

  describe('create', () => {
    const dto = { userId: 'target-user', orgId: TENANT_ID };

    beforeEach(() => {
      tenantService.findById.mockResolvedValue({
        id: TENANT_ID,
        slug: 'test-org',
      });
      userService.findById.mockResolvedValue({ id: 'target-user' });
      membershipRepo.findOne.mockResolvedValue(null); // no duplicate
    });

    it('ADMIN can create membership with OWNER role (provisioned atomically)', async () => {
      const result = await service.create(superAdminCtx(), {
        ...dto,
        role: MembershipRole.OWNER,
      });

      expect(ownerProvisioning.provisionOwner).toHaveBeenCalledWith(manager, {
        orgId: TENANT_ID,
        userId: 'target-user',
      });
      expect(ownerProvisioning.sendActivationEmail).toHaveBeenCalled();
      expect(result.membership.role).toBe(MembershipRole.OWNER);
      expect(result.ownerActivation).toEqual({
        token: 'activation-token',
        orgSlug: 'test-org',
      });
      // owners are written by provisioning, not the plain repository
      expect(membershipRepo.save).not.toHaveBeenCalled();
    });

    it('creates a plain MEMBER without school-admin access', async () => {
      const result = await service.create(superAdminCtx(), dto);

      expect(membershipRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: MembershipRole.MEMBER,
          isAdmin: false,
        }),
      );
      expect(result.ownerActivation).toBeUndefined();
      expect(ownerProvisioning.provisionOwner).not.toHaveBeenCalled();
    });

    it('Tenant OWNER can create MEMBER membership for their tenant', async () => {
      const ctx = userCtx('owner-id');
      // First findOne call: assertOwnerOrAdmin check
      membershipRepo.findOne
        .mockResolvedValueOnce(
          makeMembership({ userId: 'owner-id', role: MembershipRole.OWNER }),
        )
        // Second findOne call: duplicate check
        .mockResolvedValueOnce(null);

      const result = await service.create(ctx, { ...dto });
      expect(result).toBeDefined();
    });

    it('Tenant OWNER cannot create OWNER membership', async () => {
      const ctx = userCtx('owner-id');
      membershipRepo.findOne.mockResolvedValueOnce(
        makeMembership({ userId: 'owner-id', role: MembershipRole.OWNER }),
      );

      await expect(
        service.create(ctx, { ...dto, role: MembershipRole.OWNER }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Regular USER (non-owner) cannot create membership', async () => {
      const ctx = userCtx();
      // assertOwnerOrAdmin: no ownership found
      membershipRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.create(ctx, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ConflictException for duplicate membership', async () => {
      // For ADMIN, assertOwnerOrAdmin returns immediately (no findOne call),
      // so the first findOne call is the duplicate check
      membershipRepo.findOne.mockResolvedValueOnce(makeMembership()); // duplicate check

      await expect(service.create(superAdminCtx(), dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws NotFoundException when tenant does not exist', async () => {
      tenantService.findById.mockResolvedValue(null);
      membershipRepo.findOne.mockResolvedValue(null);

      await expect(service.create(superAdminCtx(), dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when user does not exist', async () => {
      userService.findById.mockRejectedValue(
        new NotFoundException('User not found'),
      );
      membershipRepo.findOne.mockResolvedValue(null);

      await expect(service.create(superAdminCtx(), dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects OWNER role when tenant already has an OWNER', async () => {
      // duplicate check returns null, then OWNER guard finds an existing owner
      membershipRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(
        makeMembership({
          userId: 'existing-owner',
          role: MembershipRole.OWNER,
        }),
      );

      await expect(
        service.create(superAdminCtx(), {
          ...dto,
          role: MembershipRole.OWNER,
        }),
      ).rejects.toThrow(ConflictException);
      expect(membershipRepo.save).not.toHaveBeenCalled();
      expect(ownerProvisioning.provisionOwner).not.toHaveBeenCalled();
    });
  });

  // ===================== findById =====================

  describe('findById', () => {
    it('ADMIN can view any membership', async () => {
      membershipRepo.findOne.mockResolvedValue(
        makeMembership({ userId: 'other-user' }),
      );
      const result = await service.findById(superAdminCtx(), 'mem-1');
      expect(result.id).toBe('mem-1');
    });

    it('User can view own membership', async () => {
      membershipRepo.findOne.mockResolvedValue(
        makeMembership({ userId: 'user-id' }),
      );
      const result = await service.findById(userCtx('user-id'), 'mem-1');
      expect(result.id).toBe('mem-1');
    });

    it('Tenant OWNER can view membership in their tenant', async () => {
      const ctx = userCtx('owner-id');
      membershipRepo.findOne
        // first call: finding the membership
        .mockResolvedValueOnce(
          makeMembership({ userId: 'other-user', orgId: TENANT_ID }),
        )
        // second call: assertOwnerOrAdmin ownership check
        .mockResolvedValueOnce(
          makeMembership({
            userId: 'owner-id',
            role: MembershipRole.OWNER,
            orgId: TENANT_ID,
          }),
        );

      const result = await service.findById(ctx, 'mem-1');
      expect(result).toBeDefined();
    });

    it('Regular user cannot view others membership', async () => {
      const ctx = userCtx('user-id');
      membershipRepo.findOne
        .mockResolvedValueOnce(
          makeMembership({ userId: 'other-user', orgId: TENANT_ID }),
        )
        .mockResolvedValueOnce(null); // no ownership

      await expect(service.findById(ctx, 'mem-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException for non-existent membership', async () => {
      membershipRepo.findOne.mockResolvedValue(null);
      await expect(service.findById(superAdminCtx(), 'bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ===================== findAll =====================

  describe('findAll', () => {
    it('ADMIN sees all memberships', async () => {
      const memberships = [makeMembership(), makeMembership({ id: 'mem-2' })];
      membershipRepo.find.mockResolvedValue(memberships);

      const result = await service.findAll(superAdminCtx(), {});
      expect(result).toHaveLength(2);
    });

    it('ADMIN can filter by orgId', async () => {
      membershipRepo.find.mockResolvedValue([makeMembership()]);

      await service.findAll(superAdminCtx(), { orgId: TENANT_ID });
      expect(membershipRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ orgId: TENANT_ID }) as unknown,
        }),
      );
    });

    it('Regular USER sees only own memberships', async () => {
      const ctx = userCtx('user-id');
      membershipRepo.find.mockResolvedValue([
        makeMembership({ userId: 'user-id' }),
      ]);

      const result = await service.findAll(ctx, {});
      expect(membershipRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-id' }) as unknown,
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('Regular USER querying another userId throws ForbiddenException', async () => {
      const ctx = userCtx('user-id');

      await expect(
        service.findAll(ctx, { userId: 'other-user' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ===================== findByOrgId =====================

  describe('findByOrgId', () => {
    it('ADMIN can list any tenant memberships', async () => {
      tenantService.findById.mockResolvedValue({ id: TENANT_ID });
      membershipRepo.find.mockResolvedValue([makeMembership()]);

      const result = await service.findByOrgId(superAdminCtx(), TENANT_ID);
      expect(result).toHaveLength(1);
    });

    it('Tenant OWNER can list their tenant memberships', async () => {
      const ctx = userCtx('owner-id');
      tenantService.findById.mockResolvedValue({ id: TENANT_ID });
      membershipRepo.findOne.mockResolvedValue(
        makeMembership({ userId: 'owner-id', role: MembershipRole.OWNER }),
      );
      membershipRepo.find.mockResolvedValue([makeMembership()]);

      const result = await service.findByOrgId(ctx, TENANT_ID);
      expect(result).toHaveLength(1);
    });

    it('Regular USER cannot list tenant memberships', async () => {
      const ctx = userCtx();
      tenantService.findById.mockResolvedValue({ id: TENANT_ID });
      membershipRepo.findOne.mockResolvedValue(null); // no ownership

      await expect(service.findByOrgId(ctx, TENANT_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when tenant does not exist', async () => {
      tenantService.findById.mockResolvedValue(null);

      await expect(
        service.findByOrgId(superAdminCtx(), 'bad-tenant'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ===================== findByUserId =====================

  describe('findByUserId', () => {
    it('ADMIN can query any user', async () => {
      userService.findById.mockResolvedValue({ id: 'other-user' });
      membershipRepo.find.mockResolvedValue([
        makeMembership({ userId: 'other-user' }),
      ]);

      const result = await service.findByUserId(superAdminCtx(), 'other-user');
      expect(result).toHaveLength(1);
    });

    it('User can query self', async () => {
      const ctx = userCtx('user-id');
      userService.findById.mockResolvedValue({ id: 'user-id' });
      membershipRepo.find.mockResolvedValue([
        makeMembership({ userId: 'user-id' }),
      ]);

      const result = await service.findByUserId(ctx, 'user-id');
      expect(result).toHaveLength(1);
    });

    it('User cannot query another user', async () => {
      const ctx = userCtx('user-id');

      await expect(service.findByUserId(ctx, 'other-user')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ===================== updateRole =====================

  describe('updateRole', () => {
    it('ADMIN can change any role including to OWNER', async () => {
      membershipRepo.findOne
        .mockResolvedValueOnce(makeMembership({ role: MembershipRole.MEMBER }))
        // No other OWNER on the tenant.
        .mockResolvedValueOnce(null);
      membershipRepo.save.mockImplementation((entity) =>
        Promise.resolve(entity),
      );

      const result = await service.updateRole(superAdminCtx(), 'mem-1', {
        role: MembershipRole.OWNER,
      });
      expect(result.role).toBe(MembershipRole.OWNER);
    });

    it('Tenant OWNER can change MEMBER to ADMIN', async () => {
      const ctx = userCtx('owner-id');
      membershipRepo.findOne
        // first call: find membership
        .mockResolvedValueOnce(
          makeMembership({ role: MembershipRole.MEMBER, orgId: TENANT_ID }),
        )
        // second call: assertOwnerOrAdmin
        .mockResolvedValueOnce(
          makeMembership({
            userId: 'owner-id',
            role: MembershipRole.OWNER,
            orgId: TENANT_ID,
          }),
        );
      membershipRepo.save.mockImplementation((entity) =>
        Promise.resolve(entity),
      );

      const result = await service.updateRole(ctx, 'mem-1', {
        role: MembershipRole.ADMIN,
      });
      expect(result.role).toBe(MembershipRole.ADMIN);
    });

    it('Tenant OWNER cannot promote to OWNER', async () => {
      const ctx = userCtx('owner-id');
      membershipRepo.findOne
        .mockResolvedValueOnce(
          makeMembership({ role: MembershipRole.MEMBER, orgId: TENANT_ID }),
        )
        .mockResolvedValueOnce(
          makeMembership({
            userId: 'owner-id',
            role: MembershipRole.OWNER,
            orgId: TENANT_ID,
          }),
        );

      await expect(
        service.updateRole(ctx, 'mem-1', { role: MembershipRole.OWNER }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Tenant OWNER cannot modify existing OWNER membership', async () => {
      const ctx = userCtx('owner-id');
      membershipRepo.findOne
        .mockResolvedValueOnce(
          makeMembership({ role: MembershipRole.OWNER, orgId: TENANT_ID }),
        )
        .mockResolvedValueOnce(
          makeMembership({
            userId: 'owner-id',
            role: MembershipRole.OWNER,
            orgId: TENANT_ID,
          }),
        );

      await expect(
        service.updateRole(ctx, 'mem-1', { role: MembershipRole.ADMIN }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Non-owner cannot update membership', async () => {
      const ctx = userCtx();
      membershipRepo.findOne
        .mockResolvedValueOnce(makeMembership({ orgId: TENANT_ID }))
        .mockResolvedValueOnce(null); // no ownership

      await expect(
        service.updateRole(ctx, 'mem-1', { role: MembershipRole.ADMIN }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for non-existent membership', async () => {
      membershipRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateRole(superAdminCtx(), 'bad-id', {
          role: MembershipRole.ADMIN,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects promotion to OWNER when another OWNER exists', async () => {
      membershipRepo.findOne
        // initial: membership being updated is currently MEMBER
        .mockResolvedValueOnce(
          makeMembership({ role: MembershipRole.MEMBER, orgId: TENANT_ID }),
        )
        // OWNER guard: another OWNER exists for this tenant
        .mockResolvedValueOnce(
          makeMembership({
            id: 'mem-owner',
            userId: 'other-owner',
            role: MembershipRole.OWNER,
            orgId: TENANT_ID,
          }),
        );

      await expect(
        service.updateRole(superAdminCtx(), 'mem-1', {
          role: MembershipRole.OWNER,
        }),
      ).rejects.toThrow(ConflictException);
      expect(membershipRepo.save).not.toHaveBeenCalled();
    });

    it('allows promotion to OWNER when there is no current OWNER', async () => {
      membershipRepo.findOne
        .mockResolvedValueOnce(
          makeMembership({ role: MembershipRole.MEMBER, orgId: TENANT_ID }),
        )
        .mockResolvedValueOnce(null);
      membershipRepo.save.mockImplementation((entity) =>
        Promise.resolve(entity),
      );

      const result = await service.updateRole(superAdminCtx(), 'mem-1', {
        role: MembershipRole.OWNER,
      });
      expect(result.role).toBe(MembershipRole.OWNER);
    });

    it('allows a no-op OWNER -> OWNER on the same membership', async () => {
      // membership being updated is already OWNER — OWNER guard should not run
      // (so we do NOT set up a second findOne mock).
      membershipRepo.findOne.mockResolvedValueOnce(
        makeMembership({ role: MembershipRole.OWNER, orgId: TENANT_ID }),
      );
      membershipRepo.save.mockImplementation((entity) =>
        Promise.resolve(entity),
      );

      const result = await service.updateRole(superAdminCtx(), 'mem-1', {
        role: MembershipRole.OWNER,
      });
      expect(result.role).toBe(MembershipRole.OWNER);
      // Verify the guard query was NOT issued (only 1 findOne call total).
      expect(membershipRepo.findOne).toHaveBeenCalledTimes(1);
    });
  });

  // ===================== remove =====================

  describe('remove', () => {
    it('ADMIN can remove any membership', async () => {
      membershipRepo.findOne.mockResolvedValue(makeMembership());

      await service.remove(superAdminCtx(), 'mem-1');
      expect(manager.delete).toHaveBeenCalledWith(Membership, 'mem-1');
      expect(manager.delete).toHaveBeenCalledWith(UserRole, {
        orgId: TENANT_ID,
        userId: 'user-id',
      });
      expect(sessions.revokeAllForUserInOrg).toHaveBeenCalledWith(
        'user-id',
        TENANT_ID,
      );
    });

    it('ends the sessions of a school admin demoted to member', async () => {
      membershipRepo.findOne.mockResolvedValueOnce(
        makeMembership({ role: MembershipRole.ADMIN, isAdmin: true }),
      );

      await service.updateRole(superAdminCtx(), 'mem-1', {
        role: MembershipRole.MEMBER,
      });
      expect(sessions.revokeAllForUserInOrg).toHaveBeenCalledWith(
        'user-id',
        TENANT_ID,
      );
    });

    it('Tenant OWNER can remove MEMBER from their tenant', async () => {
      const ctx = userCtx('owner-id');
      membershipRepo.findOne
        .mockResolvedValueOnce(
          makeMembership({ role: MembershipRole.MEMBER, orgId: TENANT_ID }),
        )
        .mockResolvedValueOnce(
          makeMembership({
            userId: 'owner-id',
            role: MembershipRole.OWNER,
            orgId: TENANT_ID,
          }),
        );

      await service.remove(ctx, 'mem-1');
      expect(manager.delete).toHaveBeenCalledWith(Membership, 'mem-1');
      expect(manager.delete).toHaveBeenCalledWith(UserRole, {
        orgId: TENANT_ID,
        userId: 'user-id',
      });
    });

    it('Tenant OWNER cannot remove OWNER membership', async () => {
      const ctx = userCtx('owner-id');
      membershipRepo.findOne
        .mockResolvedValueOnce(
          makeMembership({ role: MembershipRole.OWNER, orgId: TENANT_ID }),
        )
        .mockResolvedValueOnce(
          makeMembership({
            userId: 'owner-id',
            role: MembershipRole.OWNER,
            orgId: TENANT_ID,
          }),
        );

      await expect(service.remove(ctx, 'mem-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('Non-owner cannot remove membership', async () => {
      const ctx = userCtx();
      membershipRepo.findOne
        .mockResolvedValueOnce(makeMembership({ orgId: TENANT_ID }))
        .mockResolvedValueOnce(null);

      await expect(service.remove(ctx, 'mem-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException for non-existent membership', async () => {
      membershipRepo.findOne.mockResolvedValue(null);

      await expect(service.remove(superAdminCtx(), 'bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
