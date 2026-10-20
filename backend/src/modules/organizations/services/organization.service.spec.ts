import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PlatformAuditService } from '~/modules/audit/services/platform-audit.service';
import { SessionService } from '~/modules/auth/services/session.service';
import { OrganizationService } from './organization.service';
import { Organization } from '../entities/organization.entity';
import { OrganizationDomain } from '../entities/organization-domain.entity';
import { DomainStatus } from '../enums/domain-status.enum';
import { In } from 'typeorm';
import { tenantDomainCache } from '~/tenancy/tenant-slug.cache';
import { OrganizationStatus } from '../enums/organization-status.enum';
import { Membership } from '~/modules/memberships/entities/membership.entity';
import { MembershipRole } from '~/modules/memberships/enums/membership-role.enum';
import { DemoteOldOwnerTo } from '../dto/transfer-ownership.dto';
import { UserService } from '~/modules/users/services/user.service';
import { UserStatus } from '~/modules/users/enums/user-status.enum';
import { UserRole } from '~/modules/rbac/entities/user-role.entity';
import { RbacSeederService } from '~/modules/rbac/services/rbac-seeder.service';
import { OwnerProvisioningService } from '~/modules/auth/services/owner-provisioning.service';
import { RequestContextDto } from '~/common/dto/request-context.dto';

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

const ORG_ID = 'org-1';

const makeOrg = (overrides: Partial<Organization> = {}): Organization =>
  ({
    id: ORG_ID,
    name: 'Test Organization',
    slug: 'test-org',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Organization;

const makeMembership = (overrides: Partial<Membership> = {}): Membership =>
  ({
    id: 'mem-1',
    userId: 'user-id',
    orgId: ORG_ID,
    role: MembershipRole.MEMBER,
    isAdmin: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Membership;

// --- Test suite ---

describe('OrganizationService', () => {
  let service: OrganizationService;
  let orgRepo: Record<string, jest.Mock>;
  let membershipRepo: Record<string, jest.Mock>;
  let domainRepo: Record<string, jest.Mock>;
  let userService: Record<string, jest.Mock>;
  let rbacSeeder: Record<string, jest.Mock>;
  let ownerProvisioning: Record<string, jest.Mock>;
  let txMembershipRepo: Record<string, jest.Mock>;
  let txUserRoleRepo: Record<string, jest.Mock>;
  let manager: Record<string, jest.Mock>;
  let platformAudit: { record: jest.Mock };
  const sessions = {
    revokeAllForUser: jest.fn(),
    revokeAllForUserInOrg: jest.fn(),
  };

  beforeEach(async () => {
    orgRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn((entity) => Promise.resolve(entity)),
      delete: jest.fn(),
    };

    membershipRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    };

    domainRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    };

    userService = {
      findById: jest.fn((_ctx, id: string) =>
        Promise.resolve({ id, email: `${id}@test.com`, name: id }),
      ),
    };

    rbacSeeder = { seedSystemRoles: jest.fn() };
    ownerProvisioning = {
      provisionOwner: jest
        .fn()
        .mockResolvedValue({ token: 'activation-token' }),
      sendActivationEmail: jest.fn(),
    };

    // Repositories used inside dataSource.transaction(...)
    txMembershipRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOneOrFail: jest.fn(({ where }: { where: { userId: string } }) =>
        Promise.resolve(
          makeMembership({
            id: 'tx-mem-id',
            userId: where.userId,
            role: MembershipRole.OWNER,
            isAdmin: true,
          }),
        ),
      ),
      save: jest.fn((entity) => Promise.resolve(entity)),
      delete: jest.fn(),
    };
    txUserRoleRepo = { delete: jest.fn() };

    manager = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((_: unknown, data: object) => ({
        id: 'new-org-id',
        ...data,
      })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      delete: jest.fn(),
      getRepository: jest.fn((entity) =>
        entity === UserRole ? txUserRoleRepo : txMembershipRepo,
      ),
    };
    platformAudit = { record: jest.fn() };

    const mockDataSource = {
      transaction: jest.fn((cb: (m: typeof manager) => unknown) =>
        Promise.resolve(cb(manager)),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        { provide: getRepositoryToken(Organization), useValue: orgRepo },
        { provide: getRepositoryToken(Membership), useValue: membershipRepo },
        {
          provide: getRepositoryToken(OrganizationDomain),
          useValue: domainRepo,
        },
        { provide: getDataSourceToken(), useValue: mockDataSource },
        { provide: RbacSeederService, useValue: rbacSeeder },
        { provide: OwnerProvisioningService, useValue: ownerProvisioning },
        { provide: UserService, useValue: userService },
        { provide: PlatformAuditService, useValue: platformAudit },
        { provide: SessionService, useValue: sessions },
      ],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
  });

  // ===================== getAllOrganizations =====================

  describe('getAllOrganizations', () => {
    it('ADMIN sees all organizations', async () => {
      orgRepo.find.mockResolvedValue([makeOrg(), makeOrg({ id: 'org-2' })]);

      const result = await service.getAllOrganizations(superAdminCtx());
      expect(result).toHaveLength(2);
    });

    it('Regular USER sees only organizations with membership', async () => {
      membershipRepo.find.mockResolvedValue([
        makeMembership({ orgId: ORG_ID }),
      ]);
      orgRepo.find.mockResolvedValue([makeOrg()]);

      const result = await service.getAllOrganizations(userCtx('user-id'));
      expect(result).toHaveLength(1);
      expect(membershipRepo.find).toHaveBeenCalledWith({
        where: { userId: 'user-id' },
      });
    });

    it('Regular USER with no memberships sees empty list', async () => {
      membershipRepo.find.mockResolvedValue([]);

      const result = await service.getAllOrganizations(userCtx('user-id'));
      expect(result).toEqual([]);
    });
  });

  // ===================== findByIdForUser =====================

  describe('findByIdForUser', () => {
    it('ADMIN can view any organization', async () => {
      orgRepo.findOne.mockResolvedValue(makeOrg());

      const result = await service.findByIdForUser(superAdminCtx(), ORG_ID);
      expect(result.id).toBe(ORG_ID);
    });

    it('User with membership can view the organization', async () => {
      orgRepo.findOne.mockResolvedValue(makeOrg());
      membershipRepo.findOne.mockResolvedValue(makeMembership());

      const result = await service.findByIdForUser(userCtx(), ORG_ID);
      expect(result.id).toBe(ORG_ID);
    });

    it('User without membership gets ForbiddenException', async () => {
      orgRepo.findOne.mockResolvedValue(makeOrg());
      membershipRepo.findOne.mockResolvedValue(null);

      await expect(service.findByIdForUser(userCtx(), ORG_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException for a non-existent organization', async () => {
      orgRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findByIdForUser(superAdminCtx(), 'bad-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ===================== updateOrganization =====================

  describe('updateOrganization', () => {
    const dto = { name: 'Updated Name' };

    it('ADMIN can update any organization', async () => {
      orgRepo.findOne.mockResolvedValue(makeOrg());

      const result = await service.updateOrganization(
        superAdminCtx(),
        ORG_ID,
        dto,
      );
      expect(result.name).toBe('Updated Name');
    });

    it('Organization OWNER can update their organization', async () => {
      orgRepo.findOne.mockResolvedValue(makeOrg());
      membershipRepo.findOne.mockResolvedValue(
        makeMembership({ userId: 'owner-id', role: MembershipRole.OWNER }),
      );

      const result = await service.updateOrganization(
        userCtx('owner-id'),
        ORG_ID,
        dto,
      );
      expect(result.name).toBe('Updated Name');
    });

    it('Organization OWNER cannot change the organization status', async () => {
      orgRepo.findOne.mockResolvedValue(
        makeOrg({ status: OrganizationStatus.SUSPENDED }),
      );
      membershipRepo.findOne.mockResolvedValue(
        makeMembership({ userId: 'owner-id', role: MembershipRole.OWNER }),
      );

      await expect(
        service.updateOrganization(userCtx('owner-id'), ORG_ID, {
          status: OrganizationStatus.ACTIVE,
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('ADMIN can change the organization status', async () => {
      orgRepo.findOne.mockResolvedValue(
        makeOrg({ status: OrganizationStatus.ACTIVE }),
      );

      const result = await service.updateOrganization(superAdminCtx(), ORG_ID, {
        status: OrganizationStatus.SUSPENDED,
      });
      expect(result.status).toBe(OrganizationStatus.SUSPENDED);
    });

    it('Non-owner USER gets ForbiddenException', async () => {
      orgRepo.findOne.mockResolvedValue(makeOrg());
      membershipRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateOrganization(userCtx(), ORG_ID, dto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for a non-existent organization', async () => {
      orgRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateOrganization(superAdminCtx(), 'bad-id', dto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ===================== createOrganization =====================

  describe('createOrganization', () => {
    const dto = { name: 'New Organization', slug: 'new_org' };

    it('ADMIN creates an organization (with seeded roles) and no owner', async () => {
      const result = await service.createOrganization(superAdminCtx(), dto);

      expect(result.organization.id).toBe('new-org-id');
      expect(result.ownerActivation).toBeUndefined();
      expect(rbacSeeder.seedSystemRoles).toHaveBeenCalledWith(
        manager,
        'new-org-id',
      );
      expect(ownerProvisioning.provisionOwner).not.toHaveBeenCalled();
    });

    it('rejects a duplicate slug inside the transaction', async () => {
      manager.findOne.mockResolvedValue(makeOrg({ slug: 'new_org' }));

      await expect(
        service.createOrganization(superAdminCtx(), dto),
      ).rejects.toThrow(ConflictException);
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('Regular USER becomes the OWNER in the same transaction', async () => {
      const result = await service.createOrganization(userCtx('user-id'), dto);

      expect(ownerProvisioning.provisionOwner).toHaveBeenCalledWith(manager, {
        orgId: 'new-org-id',
        userId: 'user-id',
      });
      expect(ownerProvisioning.sendActivationEmail).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-id' }),
        'new_org',
        'activation-token',
      );
      expect(result.ownerActivation).toEqual({
        token: 'activation-token',
        orgSlug: 'new_org',
      });
    });

    it('ADMIN with ownerUserId provisions that user as OWNER', async () => {
      await service.createOrganization(superAdminCtx(), {
        ...dto,
        ownerUserId: 'target-owner',
      });

      expect(ownerProvisioning.provisionOwner).toHaveBeenCalledWith(manager, {
        orgId: 'new-org-id',
        userId: 'target-owner',
      });
      // ownerUserId is not an organization column
      expect(manager.create).toHaveBeenCalledWith(Organization, dto);
    });

    it('ADMIN with non-existent ownerUserId fails before any write', async () => {
      userService.findById.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(
        service.createOrganization(superAdminCtx(), {
          ...dto,
          ownerUserId: 'bad-user',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('Non-ADMIN ownerUserId is ignored; caller still becomes OWNER', async () => {
      await service.createOrganization(userCtx('user-id'), {
        ...dto,
        ownerUserId: 'someone-else',
      });

      expect(ownerProvisioning.provisionOwner).toHaveBeenCalledWith(manager, {
        orgId: 'new-org-id',
        userId: 'user-id',
      });
    });

    it('does not send the activation email when the transaction fails', async () => {
      ownerProvisioning.provisionOwner.mockRejectedValue(new Error('db error'));

      await expect(
        service.createOrganization(userCtx('user-id'), dto),
      ).rejects.toThrow('db error');
      expect(ownerProvisioning.sendActivationEmail).not.toHaveBeenCalled();
    });
  });

  // ===================== transferOwnership =====================

  describe('transferOwnership', () => {
    beforeEach(() => {
      orgRepo.findOne.mockResolvedValue(makeOrg());
    });

    it('Non-ADMIN caller -> ForbiddenException', async () => {
      await expect(
        service.transferOwnership(userCtx(), ORG_ID, {
          newOwnerUserId: 'new-owner',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Missing organization -> NotFoundException', async () => {
      orgRepo.findOne.mockResolvedValue(null);

      await expect(
        service.transferOwnership(superAdminCtx(), 'bad-org', {
          newOwnerUserId: 'new-owner',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('Missing target user -> NotFoundException', async () => {
      userService.findById.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(
        service.transferOwnership(superAdminCtx(), ORG_ID, {
          newOwnerUserId: 'ghost',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('Target user is already the OWNER -> BadRequestException', async () => {
      txMembershipRepo.find.mockResolvedValue([
        makeMembership({ userId: 'new-owner', role: MembershipRole.OWNER }),
      ]);

      await expect(
        service.transferOwnership(superAdminCtx(), ORG_ID, {
          newOwnerUserId: 'new-owner',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(ownerProvisioning.provisionOwner).not.toHaveBeenCalled();
    });

    it('demoteOldOwnerTo=admin -> old OWNER becomes ADMIN, new OWNER provisioned', async () => {
      const currentOwner = makeMembership({
        id: 'mem-current',
        userId: 'old-owner',
        role: MembershipRole.OWNER,
        isAdmin: true,
      });
      txMembershipRepo.find.mockResolvedValue([currentOwner]);

      const result = await service.transferOwnership(superAdminCtx(), ORG_ID, {
        newOwnerUserId: 'new-owner',
        demoteOldOwnerTo: DemoteOldOwnerTo.ADMIN,
      });

      expect(ownerProvisioning.provisionOwner).toHaveBeenCalledWith(manager, {
        orgId: ORG_ID,
        userId: 'new-owner',
      });
      expect(result.membership.userId).toBe('new-owner');
      expect(result.ownerActivation?.token).toBe('activation-token');
      expect(currentOwner.role).toBe(MembershipRole.ADMIN);
      expect(currentOwner.isAdmin).toBe(true);
      expect(txMembershipRepo.save).toHaveBeenCalledWith(currentOwner);
      expect(txMembershipRepo.delete).not.toHaveBeenCalled();
    });

    it('demoteOldOwnerTo=member -> old OWNER loses school admin', async () => {
      const currentOwner = makeMembership({
        userId: 'old-owner',
        role: MembershipRole.OWNER,
        isAdmin: true,
      });
      txMembershipRepo.find.mockResolvedValue([currentOwner]);

      await service.transferOwnership(superAdminCtx(), ORG_ID, {
        newOwnerUserId: 'new-owner',
        demoteOldOwnerTo: DemoteOldOwnerTo.MEMBER,
      });

      expect(currentOwner.role).toBe(MembershipRole.MEMBER);
      expect(currentOwner.isAdmin).toBe(false);
    });

    it('demoteOldOwnerTo=remove -> old OWNER membership and roles deleted', async () => {
      txMembershipRepo.find.mockResolvedValue([
        makeMembership({
          id: 'mem-current',
          userId: 'old-owner',
          role: MembershipRole.OWNER,
        }),
      ]);

      await service.transferOwnership(superAdminCtx(), ORG_ID, {
        newOwnerUserId: 'new-owner',
        demoteOldOwnerTo: DemoteOldOwnerTo.REMOVE,
      });

      expect(txMembershipRepo.delete).toHaveBeenCalledWith('mem-current');
      expect(txUserRoleRepo.delete).toHaveBeenCalledWith({
        orgId: ORG_ID,
        userId: 'old-owner',
      });
    });

    it('No existing OWNER -> just provisions the new OWNER', async () => {
      const result = await service.transferOwnership(superAdminCtx(), ORG_ID, {
        newOwnerUserId: 'new-owner',
        demoteOldOwnerTo: DemoteOldOwnerTo.REMOVE, // ignored
      });

      expect(result.membership.role).toBe(MembershipRole.OWNER);
      expect(txMembershipRepo.delete).not.toHaveBeenCalled();
    });
  });

  // ===================== reissueOwnerActivation =====================

  describe('reissueOwnerActivation', () => {
    it('mints a fresh token for the current OWNER', async () => {
      orgRepo.findOne.mockResolvedValue(makeOrg());
      membershipRepo.findOne.mockResolvedValue(
        makeMembership({ userId: 'owner-id', role: MembershipRole.OWNER }),
      );

      const result = await service.reissueOwnerActivation(
        superAdminCtx(),
        ORG_ID,
      );

      expect(ownerProvisioning.provisionOwner).toHaveBeenCalledWith(manager, {
        orgId: ORG_ID,
        userId: 'owner-id',
      });
      expect(result).toEqual({
        token: 'activation-token',
        orgSlug: 'test-org',
      });
    });

    it('rejects non-owners', async () => {
      orgRepo.findOne.mockResolvedValue(makeOrg());
      membershipRepo.findOne.mockResolvedValue(null);

      await expect(
        service.reissueOwnerActivation(userCtx(), ORG_ID),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ===================== deleteOrganization =====================

  describe('deleteOrganization', () => {
    it('throws NotFoundException for a non-existent organization', async () => {
      orgRepo.findOne.mockResolvedValue(null);

      await expect(
        service.deleteOrganization(superAdminCtx(), 'bad-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('deletes the organization row (data cascades)', async () => {
      orgRepo.findOne.mockResolvedValue(makeOrg());

      await service.deleteOrganization(superAdminCtx(), ORG_ID);

      expect(manager.delete).toHaveBeenCalledWith(Organization, ORG_ID);
      // Recorded in the same transaction, on the platform log.
      expect(platformAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'organization.deleted',
          orgId: ORG_ID,
          entityId: ORG_ID,
        }),
        manager,
      );
    });

    it("drops the org's custom domains from the host cache", async () => {
      orgRepo.findOne.mockResolvedValue(makeOrg());
      domainRepo.find.mockResolvedValue([{ hostname: 'erp.test.edu' }]);
      const invalidate = jest.spyOn(tenantDomainCache, 'invalidate');

      await service.deleteOrganization(superAdminCtx(), ORG_ID);

      expect(invalidate).toHaveBeenCalledWith('erp.test.edu');
      invalidate.mockRestore();
    });
  });

  describe('findByDomain', () => {
    it('normalizes the host and only matches verified or active domains', async () => {
      const org = makeOrg();
      domainRepo.findOne.mockResolvedValue({ org });

      await expect(service.findByDomain(' ERP.Test.edu.:443 ')).resolves.toBe(
        org,
      );
      expect(domainRepo.findOne).toHaveBeenCalledWith({
        where: {
          hostname: 'erp.test.edu',
          status: In([DomainStatus.VERIFIED, DomainStatus.ACTIVE]),
        },
        relations: { org: true },
      });
    });

    it('returns null for an unknown or unverified host', async () => {
      domainRepo.findOne.mockResolvedValue(null);
      await expect(service.findByDomain('erp.test.edu')).resolves.toBeNull();
    });

    it('returns null for an empty host without querying', async () => {
      await expect(service.findByDomain('  ')).resolves.toBeNull();
      expect(domainRepo.findOne).not.toHaveBeenCalled();
    });
  });
});
