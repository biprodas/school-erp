import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantService } from './tenant.service';
import { Tenant } from '../entities/tenant.entity';
import { Membership } from 'src/modules/platform/memberships/entities/membership.entity';
import { MembershipRole } from 'src/modules/platform/memberships/enums/membership-role.enum';
import { DemoteOldOwnerTo } from '../dto/transfer-ownership.dto';
import { UserService } from 'src/modules/platform/users/user.service';
import { PlatformRole } from 'src/modules/platform/users/enums/platform-role.enum';
import { UserStatus } from 'src/modules/platform/users/enums/user-status.enum';
import { TenantConnectionService } from '~/tenancy/tenant-connection.service';
import { TenantMigrationService } from '~/tenancy/tenant-migration.service';
import { RbacSeederService } from '~/tenanted/rbac/rbac-seeder.service';
import { OwnerProvisioningService } from '~/tenanted/auth/owner-provisioning.service';
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
      tenantId: null,
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
      role: PlatformRole.ADMIN,
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
      role: PlatformRole.USER,
      status: UserStatus.ACTIVE,
      isAdmin: false,
    },
  });

const TENANT_ID = 'tenant-1';

const makeTenant = (overrides: Partial<Tenant> = {}): Tenant =>
  ({
    id: TENANT_ID,
    name: 'Test Tenant',
    slug: 'test-tenant',
    schemaName: 'tenant_test_tenant',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Tenant;

const makeMembership = (overrides: Partial<Membership> = {}): Membership =>
  ({
    id: 'mem-1',
    userId: 'user-id',
    tenantId: TENANT_ID,
    role: MembershipRole.MEMBER,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Membership;

// --- Test suite ---

describe('TenantService', () => {
  let service: TenantService;
  let tenantRepo: Record<string, jest.Mock>;
  let membershipRepo: Record<string, jest.Mock>;
  let userService: Record<string, jest.Mock>;
  let txMembershipRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    tenantRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };

    membershipRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };

    userService = {
      findById: jest.fn().mockResolvedValue({ id: 'any-user' }),
    };

    // Transactional repository used inside dataSource.transaction(...)
    txMembershipRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((data) => ({ id: 'tx-mem-id', ...data })),
      save: jest.fn((entity) =>
        Promise.resolve({ id: entity.id ?? 'tx-mem-id', ...entity }),
      ),
      delete: jest.fn(),
    };

    const mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      query: jest.fn(),
      manager: {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn((_, data) => ({ id: 'new-tenant-id', ...data })),
        save: jest.fn((entity) => Promise.resolve(entity)),
        delete: jest.fn(),
      },
    };

    const mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
      transaction: jest.fn(async (cb: any) =>
        cb({
          getRepository: () => txMembershipRepo,
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
        { provide: getRepositoryToken(Tenant), useValue: tenantRepo },
        { provide: getRepositoryToken(Membership), useValue: membershipRepo },
        { provide: getDataSourceToken(), useValue: mockDataSource },
        {
          provide: TenantConnectionService,
          useValue: { synchronizeSchema: jest.fn() },
        },
        {
          provide: TenantMigrationService,
          useValue: { runMigrationsForSchema: jest.fn() },
        },
        {
          provide: RbacSeederService,
          useValue: { seedSystemRoles: jest.fn() },
        },
        {
          provide: OwnerProvisioningService,
          useValue: {
            provisionOwner: jest
              .fn()
              .mockResolvedValue({ token: 'activation-token' }),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('development') },
        },
        { provide: UserService, useValue: userService },
      ],
    }).compile();

    service = module.get<TenantService>(TenantService);
  });

  // ===================== getAllTenants =====================

  describe('getAllTenants', () => {
    it('ADMIN sees all tenants', async () => {
      const tenants = [makeTenant(), makeTenant({ id: 'tenant-2' })];
      tenantRepo.find.mockResolvedValue(tenants);

      const result = await service.getAllTenants(superAdminCtx());
      expect(result).toHaveLength(2);
      expect(tenantRepo.find).toHaveBeenCalled();
    });

    it('Regular USER sees only tenants with membership', async () => {
      const ctx = userCtx('user-id');
      membershipRepo.find.mockResolvedValue([
        makeMembership({ tenantId: TENANT_ID }),
      ]);
      tenantRepo.find.mockResolvedValue([makeTenant()]);

      const result = await service.getAllTenants(ctx);
      expect(result).toHaveLength(1);
      expect(membershipRepo.find).toHaveBeenCalledWith({
        where: { userId: 'user-id' },
      });
    });

    it('Regular USER with no memberships sees empty list', async () => {
      const ctx = userCtx('user-id');
      membershipRepo.find.mockResolvedValue([]);

      const result = await service.getAllTenants(ctx);
      expect(result).toEqual([]);
    });
  });

  // ===================== findByIdForUser =====================

  describe('findByIdForUser', () => {
    it('ADMIN can view any tenant', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());

      const result = await service.findByIdForUser(superAdminCtx(), TENANT_ID);
      expect(result.id).toBe(TENANT_ID);
    });

    it('User with membership can view tenant', async () => {
      const ctx = userCtx('user-id');
      tenantRepo.findOne.mockResolvedValue(makeTenant());
      membershipRepo.findOne.mockResolvedValue(
        makeMembership({ userId: 'user-id' }),
      );

      const result = await service.findByIdForUser(ctx, TENANT_ID);
      expect(result.id).toBe(TENANT_ID);
    });

    it('User without membership gets ForbiddenException', async () => {
      const ctx = userCtx('user-id');
      tenantRepo.findOne.mockResolvedValue(makeTenant());
      membershipRepo.findOne.mockResolvedValue(null);

      await expect(service.findByIdForUser(ctx, TENANT_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException for non-existent tenant', async () => {
      tenantRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findByIdForUser(superAdminCtx(), 'bad-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ===================== updateTenant =====================

  describe('updateTenant', () => {
    const dto = { name: 'Updated Name' };

    it('ADMIN can update any tenant', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());
      tenantRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.updateTenant(
        superAdminCtx(),
        TENANT_ID,
        dto,
      );
      expect(result.name).toBe('Updated Name');
    });

    it('Tenant OWNER can update their tenant', async () => {
      const ctx = userCtx('owner-id');
      tenantRepo.findOne.mockResolvedValue(makeTenant());
      membershipRepo.findOne.mockResolvedValue(
        makeMembership({ userId: 'owner-id', role: MembershipRole.OWNER }),
      );
      tenantRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.updateTenant(ctx, TENANT_ID, dto);
      expect(result.name).toBe('Updated Name');
    });

    it('Non-owner USER gets ForbiddenException', async () => {
      const ctx = userCtx('user-id');
      tenantRepo.findOne.mockResolvedValue(makeTenant());
      membershipRepo.findOne.mockResolvedValue(null); // no OWNER membership

      await expect(service.updateTenant(ctx, TENANT_ID, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException for non-existent tenant', async () => {
      tenantRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateTenant(superAdminCtx(), 'bad-id', dto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ===================== createTenant =====================

  describe('createTenant', () => {
    const dto = { name: 'New Tenant', slug: 'new-tenant' };

    it('ADMIN creates tenant without auto-membership', async () => {
      const result = await service.createTenant(superAdminCtx(), dto);
      expect(result).toBeDefined();
      // ADMIN should NOT get an auto-membership
      expect(membershipRepo.save).not.toHaveBeenCalled();
    });

    it('Regular USER creates tenant with auto OWNER membership', async () => {
      const ctx = userCtx('user-id');
      const result = await service.createTenant(ctx, dto);
      expect(result).toBeDefined();
      expect(membershipRepo.save).toHaveBeenCalled();
      expect(membershipRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-id',
          role: MembershipRole.OWNER,
        }),
      );
    });

    it('ADMIN with ownerUserId creates OWNER membership for that user', async () => {
      userService.findById.mockResolvedValue({ id: 'target-owner' });

      await service.createTenant(superAdminCtx(), {
        ...dto,
        ownerUserId: 'target-owner',
      });

      expect(userService.findById).toHaveBeenCalledWith(
        expect.anything(),
        'target-owner',
      );
      expect(membershipRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'target-owner',
          role: MembershipRole.OWNER,
        }),
      );
      expect(membershipRepo.save).toHaveBeenCalled();
    });

    it('ADMIN with non-existent ownerUserId throws NotFoundException before tenant write', async () => {
      userService.findById.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(
        service.createTenant(superAdminCtx(), {
          ...dto,
          ownerUserId: 'bad-user',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(membershipRepo.save).not.toHaveBeenCalled();
    });

    it('Non-ADMIN with ownerUserId in payload — ownerUserId is ignored; caller still becomes OWNER', async () => {
      const ctx = userCtx('user-id');
      await service.createTenant(ctx, {
        ...dto,
        ownerUserId: 'someone-else',
      });

      expect(membershipRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-id',
          role: MembershipRole.OWNER,
        }),
      );
    });
  });

  // ===================== transferOwnership =====================

  describe('transferOwnership', () => {
    const TENANT = makeTenant();

    beforeEach(() => {
      tenantRepo.findOne.mockResolvedValue(TENANT);
      userService.findById.mockResolvedValue({ id: 'new-owner' });
    });

    it('Non-ADMIN caller -> ForbiddenException', async () => {
      await expect(
        service.transferOwnership(userCtx('user-id'), TENANT_ID, {
          newOwnerUserId: 'new-owner',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Missing tenant -> NotFoundException', async () => {
      tenantRepo.findOne.mockResolvedValue(null);

      await expect(
        service.transferOwnership(superAdminCtx(), 'bad-tenant', {
          newOwnerUserId: 'new-owner',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('Missing target user -> NotFoundException', async () => {
      userService.findById.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(
        service.transferOwnership(superAdminCtx(), TENANT_ID, {
          newOwnerUserId: 'ghost',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('Target user is already the OWNER -> BadRequestException', async () => {
      txMembershipRepo.find.mockResolvedValue([
        makeMembership({
          id: 'mem-current',
          userId: 'new-owner',
          role: MembershipRole.OWNER,
        }),
      ]);

      await expect(
        service.transferOwnership(superAdminCtx(), TENANT_ID, {
          newOwnerUserId: 'new-owner',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Existing OWNER + demoteOldOwnerTo=admin -> old OWNER becomes ADMIN, new OWNER inserted', async () => {
      const currentOwner = makeMembership({
        id: 'mem-current',
        userId: 'old-owner',
        role: MembershipRole.OWNER,
      });
      txMembershipRepo.find.mockResolvedValue([currentOwner]);
      // No existing membership for the target user.
      txMembershipRepo.findOne.mockResolvedValue(null);

      const result = await service.transferOwnership(
        superAdminCtx(),
        TENANT_ID,
        {
          newOwnerUserId: 'new-owner',
          demoteOldOwnerTo: DemoteOldOwnerTo.ADMIN,
        },
      );

      expect(result.membership.role).toBe(MembershipRole.OWNER);
      expect(result.membership.userId).toBe('new-owner');
      // New OWNER membership created.
      expect(txMembershipRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'new-owner',
          role: MembershipRole.OWNER,
        }),
      );
      // Old OWNER demoted to ADMIN (mutated then saved).
      expect(currentOwner.role).toBe(MembershipRole.ADMIN);
      expect(txMembershipRepo.save).toHaveBeenCalledWith(currentOwner);
      expect(txMembershipRepo.delete).not.toHaveBeenCalled();
    });

    it('Existing OWNER + demoteOldOwnerTo=remove -> old OWNER deleted', async () => {
      const currentOwner = makeMembership({
        id: 'mem-current',
        userId: 'old-owner',
        role: MembershipRole.OWNER,
      });
      txMembershipRepo.find.mockResolvedValue([currentOwner]);
      txMembershipRepo.findOne.mockResolvedValue(null);

      await service.transferOwnership(superAdminCtx(), TENANT_ID, {
        newOwnerUserId: 'new-owner',
        demoteOldOwnerTo: DemoteOldOwnerTo.REMOVE,
      });

      expect(txMembershipRepo.delete).toHaveBeenCalledWith('mem-current');
    });

    it('Existing OWNER + target already has a non-OWNER membership -> promotes that row instead of inserting', async () => {
      const currentOwner = makeMembership({
        id: 'mem-current',
        userId: 'old-owner',
        role: MembershipRole.OWNER,
      });
      const targetExisting = makeMembership({
        id: 'mem-target',
        userId: 'new-owner',
        role: MembershipRole.MEMBER,
      });
      txMembershipRepo.find.mockResolvedValue([currentOwner]);
      txMembershipRepo.findOne.mockResolvedValue(targetExisting);

      await service.transferOwnership(superAdminCtx(), TENANT_ID, {
        newOwnerUserId: 'new-owner',
      });

      expect(targetExisting.role).toBe(MembershipRole.OWNER);
      expect(txMembershipRepo.save).toHaveBeenCalledWith(targetExisting);
      expect(txMembershipRepo.create).not.toHaveBeenCalled();
    });

    it('Tenant has no existing OWNER -> just inserts new OWNER, no demotion', async () => {
      txMembershipRepo.find.mockResolvedValue([]);
      txMembershipRepo.findOne.mockResolvedValue(null);

      const result = await service.transferOwnership(
        superAdminCtx(),
        TENANT_ID,
        {
          newOwnerUserId: 'new-owner',
          demoteOldOwnerTo: DemoteOldOwnerTo.REMOVE, // ignored
        },
      );

      expect(result.membership.userId).toBe('new-owner');
      expect(result.membership.role).toBe(MembershipRole.OWNER);
      expect(txMembershipRepo.delete).not.toHaveBeenCalled();
    });
  });

  // ===================== deleteTenant =====================

  describe('deleteTenant', () => {
    it('throws NotFoundException for non-existent tenant', async () => {
      tenantRepo.findOne.mockResolvedValue(null);

      await expect(
        service.deleteTenant(superAdminCtx(), 'bad-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('deletes tenant and schema successfully', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());

      await service.deleteTenant(superAdminCtx(), TENANT_ID);
      // If no exception, the delete succeeded
    });
  });
});
