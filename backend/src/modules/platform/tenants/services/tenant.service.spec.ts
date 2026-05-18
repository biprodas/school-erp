import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantService } from './tenant.service';
import { Tenant } from '../entities/tenant.entity';
import { Membership } from 'src/modules/platform/memberships/entities/membership.entity';
import { MembershipRole } from 'src/modules/platform/memberships/enums/membership-role.enum';
import { PlatformRole } from 'src/modules/platform/users/enums/platform-role.enum';
import { UserStatus } from 'src/modules/platform/users/enums/user-status.enum';
import { TenantConnectionService } from '~/tenancy/tenant-connection.service';
import { TenantMigrationService } from '~/tenancy/tenant-migration.service';
import { RbacSeederService } from '~/tenanted/rbac/rbac-seeder.service';
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
      role: PlatformRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
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
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('development') },
        },
      ],
    }).compile();

    service = module.get<TenantService>(TenantService);
  });

  // ===================== getAllTenants =====================

  describe('getAllTenants', () => {
    it('SUPER_ADMIN sees all tenants', async () => {
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
    it('SUPER_ADMIN can view any tenant', async () => {
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

    it('SUPER_ADMIN can update any tenant', async () => {
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

    it('SUPER_ADMIN creates tenant without auto-membership', async () => {
      const result = await service.createTenant(superAdminCtx(), dto);
      expect(result).toBeDefined();
      // SUPER_ADMIN should NOT get an auto-membership
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
