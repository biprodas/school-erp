import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { TenantController } from 'src/modules/platform/tenants/controllers/tenant.controller';
import { TenantService } from 'src/modules/platform/tenants/services/tenant.service';
import { Tenant } from 'src/modules/platform/tenants/entities/tenant.entity';
import { Membership } from 'src/modules/platform/memberships/entities/membership.entity';
import { MembershipRole } from 'src/modules/platform/memberships/enums/membership-role.enum';
import { PlatformJwtStrategy } from 'src/modules/platform/auth/platform-jwt.strategy';
import { PlatformRole } from 'src/modules/platform/users/enums/platform-role.enum';
import { UserStatus } from 'src/modules/platform/users/enums/user-status.enum';
import { TenantConnectionService } from '~/tenancy/tenant-connection.service';
import { TenantMigrationService } from '~/tenancy/tenant-migration.service';
import { ConfigService } from '@nestjs/config';

const JWT_SECRET = 'test-secret-key-for-e2e-testing-32chars!';

const ADMIN_ID = 'f8507227-7441-42b4-ba59-9b5d08e8b393';
const USER_ID = '32097309-2d93-492a-888d-ffb47743b86d';
const OWNER_ID = '9b54cc23-ace4-4184-a6f5-781d34eea07a';
const TENANT_ID = '357c9a54-0107-40e6-b7c3-39885caa2b93';
const NONEXISTENT_ID = '227adcb7-da65-47a0-8593-5fcd2399d569';

const makeTenant = (overrides: Partial<Tenant> = {}): Tenant =>
  ({
    id: TENANT_ID,
    name: 'Test Tenant',
    slug: 'test_tenant',
    schemaName: 'tenant_test_tenant',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Tenant;

describe('Tenant E2E', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let tenantRepo: Record<string, jest.Mock>;
  let membershipRepo: Record<string, jest.Mock>;

  const adminToken = () =>
    jwtService.sign({ sub: ADMIN_ID, email: 'admin@test.com', role: PlatformRole.SUPER_ADMIN, status: UserStatus.ACTIVE });

  const userToken = (id = USER_ID) =>
    jwtService.sign({ sub: id, email: 'user@test.com', role: PlatformRole.USER, status: UserStatus.ACTIVE });

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
        create: jest.fn((_, data) => ({ id: TENANT_ID, ...data })),
        save: jest.fn((entity) => Promise.resolve(entity)),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule,
        JwtModule.register({ secret: JWT_SECRET, signOptions: { expiresIn: '1h' } }),
      ],
      controllers: [TenantController],
      providers: [
        TenantService,
        PlatformJwtStrategy,
        { provide: getRepositoryToken(Tenant), useValue: tenantRepo },
        { provide: getRepositoryToken(Membership), useValue: membershipRepo },
        { provide: getDataSourceToken(), useValue: { createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner) } },
        { provide: TenantConnectionService, useValue: { synchronizeSchema: jest.fn() } },
        { provide: TenantMigrationService, useValue: { runMigrationsForSchema: jest.fn() } },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'jwt.secret') return JWT_SECRET;
              if (key === 'NODE_ENV') return 'development';
              return null;
            },
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(async () => {
    await app.close();
  });

  // ===================== Authentication =====================

  describe('Authentication', () => {
    it('returns 401 without token', () => {
      return request(app.getHttpServer()).get('/tenants').expect(401);
    });
  });

  // ===================== GET /tenants =====================

  describe('GET /tenants', () => {
    it('SUPER_ADMIN sees all tenants', async () => {
      tenantRepo.find.mockResolvedValue([makeTenant(), makeTenant({ id: '00000000-0000-0000-0000-000000000011' })]);

      const res = await request(app.getHttpServer())
        .get('/tenants')
        .set('Authorization', `Bearer ${adminToken()}`)
        .expect(200);

      expect(res.body.data).toHaveLength(2);
    });

    it('Regular USER sees only tenants with membership', async () => {
      membershipRepo.find.mockResolvedValue([{ tenantId: TENANT_ID }]);
      tenantRepo.find.mockResolvedValue([makeTenant()]);

      const res = await request(app.getHttpServer())
        .get('/tenants')
        .set('Authorization', `Bearer ${userToken()}`)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
    });
  });

  // ===================== GET /tenants/:id =====================

  describe('GET /tenants/:id', () => {
    it('SUPER_ADMIN can view any tenant', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());

      await request(app.getHttpServer())
        .get(`/tenants/${TENANT_ID}`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .expect(200);
    });

    it('User with membership can view tenant', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());
      membershipRepo.findOne.mockResolvedValue({ tenantId: TENANT_ID, userId: USER_ID });

      await request(app.getHttpServer())
        .get(`/tenants/${TENANT_ID}`)
        .set('Authorization', `Bearer ${userToken()}`)
        .expect(200);
    });

    it('User without membership gets 403', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());
      membershipRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get(`/tenants/${TENANT_ID}`)
        .set('Authorization', `Bearer ${userToken()}`)
        .expect(403);
    });

    it('Non-existent tenant returns 404', async () => {
      tenantRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get(`/tenants/${NONEXISTENT_ID}`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .expect(404);
    });
  });

  // ===================== POST /tenants =====================

  describe('POST /tenants', () => {
    it('Any authenticated user can create a tenant', async () => {
      const res = await request(app.getHttpServer())
        .post('/tenants')
        .set('Authorization', `Bearer ${userToken()}`)
        .send({ name: 'New Tenant', slug: 'new_tenant' })
        .expect(201);

      expect(res.body.success).toBe(true);
    });
  });

  // ===================== PATCH /tenants/:id =====================

  describe('PATCH /tenants/:id', () => {
    it('SUPER_ADMIN can update any tenant', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());
      tenantRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      await request(app.getHttpServer())
        .patch(`/tenants/${TENANT_ID}`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ name: 'Updated' })
        .expect(200);
    });

    it('Tenant OWNER can update their tenant', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());
      membershipRepo.findOne.mockResolvedValue({ userId: OWNER_ID, role: MembershipRole.OWNER });
      tenantRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      await request(app.getHttpServer())
        .patch(`/tenants/${TENANT_ID}`)
        .set('Authorization', `Bearer ${userToken(OWNER_ID)}`)
        .send({ name: 'Updated' })
        .expect(200);
    });

    it('Non-owner USER gets 403', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());
      membershipRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .patch(`/tenants/${TENANT_ID}`)
        .set('Authorization', `Bearer ${userToken()}`)
        .send({ name: 'Hacked' })
        .expect(403);
    });
  });

  // ===================== DELETE /tenants/:id =====================

  describe('DELETE /tenants/:id', () => {
    it('SUPER_ADMIN can delete tenant', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());

      await request(app.getHttpServer())
        .delete(`/tenants/${TENANT_ID}`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .expect(200);
    });

    it('Regular USER gets 403', () => {
      return request(app.getHttpServer())
        .delete(`/tenants/${TENANT_ID}`)
        .set('Authorization', `Bearer ${userToken()}`)
        .expect(403);
    });
  });
});
