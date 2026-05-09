import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MembershipService } from './membership.service';
import { Membership } from '../entities/membership.entity';
import { MembershipRole } from '../enums/membership-role.enum';
import { TenantService } from 'src/modules/platform/tenants/services/tenant.service';
import { UserService } from 'src/modules/platform/users/user.service';
import { PlatformRole } from 'src/modules/platform/users/enums/platform-role.enum';
import { UserStatus } from 'src/modules/platform/users/enums/user-status.enum';
import { RequestContextDto } from '~/common/dto/request-context.dto';

// --- Helpers ---

const makeCtx = (overrides: Partial<RequestContextDto> = {}): RequestContextDto =>
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
    user: { id: 'admin-id', email: 'admin@test.com', role: PlatformRole.SUPER_ADMIN, status: UserStatus.ACTIVE },
  });

const userCtx = (id = 'user-id') =>
  makeCtx({
    userId: id,
    user: { id, email: 'user@test.com', role: PlatformRole.USER, status: UserStatus.ACTIVE },
  });

const TENANT_ID = 'tenant-1';
const OTHER_TENANT_ID = 'tenant-2';

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

describe('MembershipService', () => {
  let service: MembershipService;
  let membershipRepo: Record<string, jest.Mock>;
  let tenantService: Record<string, jest.Mock>;
  let userService: Record<string, jest.Mock>;

  beforeEach(async () => {
    membershipRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn((entity) => Promise.resolve({ id: 'new-mem', ...entity })),
      delete: jest.fn(),
    };

    tenantService = {
      findById: jest.fn(),
    };

    userService = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembershipService,
        { provide: getRepositoryToken(Membership), useValue: membershipRepo },
        { provide: TenantService, useValue: tenantService },
        { provide: UserService, useValue: userService },
      ],
    }).compile();

    service = module.get<MembershipService>(MembershipService);
  });

  // ===================== create =====================

  describe('create', () => {
    const dto = { userId: 'target-user', tenantId: TENANT_ID };

    beforeEach(() => {
      tenantService.findById.mockResolvedValue({ id: TENANT_ID });
      userService.findById.mockResolvedValue({ id: 'target-user' });
      membershipRepo.findOne.mockResolvedValue(null); // no duplicate
    });

    it('SUPER_ADMIN can create membership with OWNER role', async () => {
      const result = await service.create(superAdminCtx(), { ...dto, role: MembershipRole.OWNER });
      expect(result).toBeDefined();
      expect(membershipRepo.save).toHaveBeenCalled();
    });

    it('Tenant OWNER can create MEMBER membership for their tenant', async () => {
      const ctx = userCtx('owner-id');
      // First findOne call: assertOwnerOrSuperAdmin check
      membershipRepo.findOne
        .mockResolvedValueOnce(makeMembership({ userId: 'owner-id', role: MembershipRole.OWNER }))
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
      // assertOwnerOrSuperAdmin: no ownership found
      membershipRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.create(ctx, dto)).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException for duplicate membership', async () => {
      // For SUPER_ADMIN, assertOwnerOrSuperAdmin returns immediately (no findOne call),
      // so the first findOne call is the duplicate check
      membershipRepo.findOne.mockResolvedValueOnce(makeMembership()); // duplicate check

      await expect(
        service.create(superAdminCtx(), dto),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when tenant does not exist', async () => {
      tenantService.findById.mockResolvedValue(null);
      membershipRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create(superAdminCtx(), dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when user does not exist', async () => {
      userService.findById.mockRejectedValue(new NotFoundException('User not found'));
      membershipRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create(superAdminCtx(), dto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ===================== findById =====================

  describe('findById', () => {
    it('SUPER_ADMIN can view any membership', async () => {
      membershipRepo.findOne.mockResolvedValue(makeMembership({ userId: 'other-user' }));
      const result = await service.findById(superAdminCtx(), 'mem-1');
      expect(result.id).toBe('mem-1');
    });

    it('User can view own membership', async () => {
      membershipRepo.findOne.mockResolvedValue(makeMembership({ userId: 'user-id' }));
      const result = await service.findById(userCtx('user-id'), 'mem-1');
      expect(result.id).toBe('mem-1');
    });

    it('Tenant OWNER can view membership in their tenant', async () => {
      const ctx = userCtx('owner-id');
      membershipRepo.findOne
        // first call: finding the membership
        .mockResolvedValueOnce(makeMembership({ userId: 'other-user', tenantId: TENANT_ID }))
        // second call: assertOwnerOrSuperAdmin ownership check
        .mockResolvedValueOnce(makeMembership({ userId: 'owner-id', role: MembershipRole.OWNER, tenantId: TENANT_ID }));

      const result = await service.findById(ctx, 'mem-1');
      expect(result).toBeDefined();
    });

    it('Regular user cannot view others membership', async () => {
      const ctx = userCtx('user-id');
      membershipRepo.findOne
        .mockResolvedValueOnce(makeMembership({ userId: 'other-user', tenantId: TENANT_ID }))
        .mockResolvedValueOnce(null); // no ownership

      await expect(service.findById(ctx, 'mem-1')).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for non-existent membership', async () => {
      membershipRepo.findOne.mockResolvedValue(null);
      await expect(service.findById(superAdminCtx(), 'bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ===================== findAll =====================

  describe('findAll', () => {
    it('SUPER_ADMIN sees all memberships', async () => {
      const memberships = [makeMembership(), makeMembership({ id: 'mem-2' })];
      membershipRepo.find.mockResolvedValue(memberships);

      const result = await service.findAll(superAdminCtx(), {});
      expect(result).toHaveLength(2);
    });

    it('SUPER_ADMIN can filter by tenantId', async () => {
      membershipRepo.find.mockResolvedValue([makeMembership()]);

      await service.findAll(superAdminCtx(), { tenantId: TENANT_ID });
      expect(membershipRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_ID }) }),
      );
    });

    it('Regular USER sees only own memberships', async () => {
      const ctx = userCtx('user-id');
      membershipRepo.find.mockResolvedValue([makeMembership({ userId: 'user-id' })]);

      const result = await service.findAll(ctx, {});
      expect(membershipRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: 'user-id' }) }),
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

  // ===================== findByTenantId =====================

  describe('findByTenantId', () => {
    it('SUPER_ADMIN can list any tenant memberships', async () => {
      tenantService.findById.mockResolvedValue({ id: TENANT_ID });
      membershipRepo.find.mockResolvedValue([makeMembership()]);

      const result = await service.findByTenantId(superAdminCtx(), TENANT_ID);
      expect(result).toHaveLength(1);
    });

    it('Tenant OWNER can list their tenant memberships', async () => {
      const ctx = userCtx('owner-id');
      tenantService.findById.mockResolvedValue({ id: TENANT_ID });
      membershipRepo.findOne.mockResolvedValue(
        makeMembership({ userId: 'owner-id', role: MembershipRole.OWNER }),
      );
      membershipRepo.find.mockResolvedValue([makeMembership()]);

      const result = await service.findByTenantId(ctx, TENANT_ID);
      expect(result).toHaveLength(1);
    });

    it('Regular USER cannot list tenant memberships', async () => {
      const ctx = userCtx();
      tenantService.findById.mockResolvedValue({ id: TENANT_ID });
      membershipRepo.findOne.mockResolvedValue(null); // no ownership

      await expect(service.findByTenantId(ctx, TENANT_ID)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when tenant does not exist', async () => {
      tenantService.findById.mockResolvedValue(null);

      await expect(
        service.findByTenantId(superAdminCtx(), 'bad-tenant'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ===================== findByUserId =====================

  describe('findByUserId', () => {
    it('SUPER_ADMIN can query any user', async () => {
      userService.findById.mockResolvedValue({ id: 'other-user' });
      membershipRepo.find.mockResolvedValue([makeMembership({ userId: 'other-user' })]);

      const result = await service.findByUserId(superAdminCtx(), 'other-user');
      expect(result).toHaveLength(1);
    });

    it('User can query self', async () => {
      const ctx = userCtx('user-id');
      userService.findById.mockResolvedValue({ id: 'user-id' });
      membershipRepo.find.mockResolvedValue([makeMembership({ userId: 'user-id' })]);

      const result = await service.findByUserId(ctx, 'user-id');
      expect(result).toHaveLength(1);
    });

    it('User cannot query another user', async () => {
      const ctx = userCtx('user-id');

      await expect(service.findByUserId(ctx, 'other-user')).rejects.toThrow(ForbiddenException);
    });
  });

  // ===================== updateRole =====================

  describe('updateRole', () => {
    it('SUPER_ADMIN can change any role including to OWNER', async () => {
      membershipRepo.findOne.mockResolvedValue(
        makeMembership({ role: MembershipRole.MEMBER }),
      );
      membershipRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.updateRole(superAdminCtx(), 'mem-1', { role: MembershipRole.OWNER });
      expect(result.role).toBe(MembershipRole.OWNER);
    });

    it('Tenant OWNER can change MEMBER to ADMIN', async () => {
      const ctx = userCtx('owner-id');
      membershipRepo.findOne
        // first call: find membership
        .mockResolvedValueOnce(makeMembership({ role: MembershipRole.MEMBER, tenantId: TENANT_ID }))
        // second call: assertOwnerOrSuperAdmin
        .mockResolvedValueOnce(makeMembership({ userId: 'owner-id', role: MembershipRole.OWNER, tenantId: TENANT_ID }));
      membershipRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.updateRole(ctx, 'mem-1', { role: MembershipRole.ADMIN });
      expect(result.role).toBe(MembershipRole.ADMIN);
    });

    it('Tenant OWNER cannot promote to OWNER', async () => {
      const ctx = userCtx('owner-id');
      membershipRepo.findOne
        .mockResolvedValueOnce(makeMembership({ role: MembershipRole.MEMBER, tenantId: TENANT_ID }))
        .mockResolvedValueOnce(makeMembership({ userId: 'owner-id', role: MembershipRole.OWNER, tenantId: TENANT_ID }));

      await expect(
        service.updateRole(ctx, 'mem-1', { role: MembershipRole.OWNER }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Tenant OWNER cannot modify existing OWNER membership', async () => {
      const ctx = userCtx('owner-id');
      membershipRepo.findOne
        .mockResolvedValueOnce(makeMembership({ role: MembershipRole.OWNER, tenantId: TENANT_ID }))
        .mockResolvedValueOnce(makeMembership({ userId: 'owner-id', role: MembershipRole.OWNER, tenantId: TENANT_ID }));

      await expect(
        service.updateRole(ctx, 'mem-1', { role: MembershipRole.ADMIN }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Non-owner cannot update membership', async () => {
      const ctx = userCtx();
      membershipRepo.findOne
        .mockResolvedValueOnce(makeMembership({ tenantId: TENANT_ID }))
        .mockResolvedValueOnce(null); // no ownership

      await expect(
        service.updateRole(ctx, 'mem-1', { role: MembershipRole.ADMIN }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for non-existent membership', async () => {
      membershipRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateRole(superAdminCtx(), 'bad-id', { role: MembershipRole.ADMIN }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ===================== remove =====================

  describe('remove', () => {
    it('SUPER_ADMIN can remove any membership', async () => {
      membershipRepo.findOne.mockResolvedValue(makeMembership());

      await service.remove(superAdminCtx(), 'mem-1');
      expect(membershipRepo.delete).toHaveBeenCalledWith('mem-1');
    });

    it('Tenant OWNER can remove MEMBER from their tenant', async () => {
      const ctx = userCtx('owner-id');
      membershipRepo.findOne
        .mockResolvedValueOnce(makeMembership({ role: MembershipRole.MEMBER, tenantId: TENANT_ID }))
        .mockResolvedValueOnce(makeMembership({ userId: 'owner-id', role: MembershipRole.OWNER, tenantId: TENANT_ID }));

      await service.remove(ctx, 'mem-1');
      expect(membershipRepo.delete).toHaveBeenCalledWith('mem-1');
    });

    it('Tenant OWNER cannot remove OWNER membership', async () => {
      const ctx = userCtx('owner-id');
      membershipRepo.findOne
        .mockResolvedValueOnce(makeMembership({ role: MembershipRole.OWNER, tenantId: TENANT_ID }))
        .mockResolvedValueOnce(makeMembership({ userId: 'owner-id', role: MembershipRole.OWNER, tenantId: TENANT_ID }));

      await expect(service.remove(ctx, 'mem-1')).rejects.toThrow(ForbiddenException);
    });

    it('Non-owner cannot remove membership', async () => {
      const ctx = userCtx();
      membershipRepo.findOne
        .mockResolvedValueOnce(makeMembership({ tenantId: TENANT_ID }))
        .mockResolvedValueOnce(null);

      await expect(service.remove(ctx, 'mem-1')).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for non-existent membership', async () => {
      membershipRepo.findOne.mockResolvedValue(null);

      await expect(service.remove(superAdminCtx(), 'bad-id')).rejects.toThrow(NotFoundException);
    });
  });
});
