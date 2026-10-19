import { Test, TestingModule } from '@nestjs/testing';
import { ACTIVE_SESSIONS, TEST_SESSION_ID } from './support/sessions';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { OrganizationController } from '~/modules/organizations/controllers/organization.controller';
import { OrganizationService } from '~/modules/organizations/services/organization.service';
import { Organization } from '~/modules/organizations/entities/organization.entity';
import { OrganizationDomain } from '~/modules/organizations/entities/organization-domain.entity';
import { Membership } from '~/modules/memberships/entities/membership.entity';
import { MembershipRole } from '~/modules/memberships/enums/membership-role.enum';
import { PlatformJwtStrategy } from '~/modules/auth/strategies/platform-jwt.strategy';
import { UserStatus } from '~/modules/users/enums/user-status.enum';
import { UserService } from '~/modules/users/services/user.service';
import { RbacSeederService } from '~/modules/rbac/services/rbac-seeder.service';
import { OwnerProvisioningService } from '~/modules/auth/services/owner-provisioning.service';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ResponseEnvelopeInterceptor } from '~/common/interceptors/response-envelope.interceptor';

const JWT_SECRET = 'test-secret-key-for-e2e-testing-32chars!';

const ADMIN_ID = 'f8507227-7441-42b4-ba59-9b5d08e8b393';
const USER_ID = '32097309-2d93-492a-888d-ffb47743b86d';
const OWNER_ID = '9b54cc23-ace4-4184-a6f5-781d34eea07a';
const TENANT_ID = '357c9a54-0107-40e6-b7c3-39885caa2b93';
const NONEXISTENT_ID = '227adcb7-da65-47a0-8593-5fcd2399d569';

const makeTenant = (overrides: Partial<Organization> = {}): Organization =>
  ({
    id: TENANT_ID,
    name: 'Test Organization',
    slug: 'test_org',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Organization;

describe('Organization E2E', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let tenantRepo: Record<string, jest.Mock>;
  let membershipRepo: Record<string, jest.Mock>;

  const adminToken = () =>
    jwtService.sign({
      sub: ADMIN_ID,
      status: UserStatus.ACTIVE,
      isAdmin: true,
      sid: TEST_SESSION_ID,
    });

  const userToken = (id = USER_ID) =>
    jwtService.sign({
      sub: id,
      status: UserStatus.ACTIVE,
      isAdmin: false,
      sid: TEST_SESSION_ID,
    });

  beforeEach(async () => {
    tenantRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn((entity) => Promise.resolve(entity)),
      delete: jest.fn(),
    };

    membershipRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((data: object) => ({ ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };

    const manager = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((_: unknown, data: object) => ({
        id: TENANT_ID,
        ...data,
      })),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule,
        JwtModule.register({
          secret: JWT_SECRET,
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [OrganizationController],
      providers: [
        OrganizationService,
        PlatformJwtStrategy,
        ACTIVE_SESSIONS,
        { provide: getRepositoryToken(Organization), useValue: tenantRepo },
        { provide: getRepositoryToken(Membership), useValue: membershipRepo },
        {
          provide: getRepositoryToken(OrganizationDomain),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: getDataSourceToken(),
          useValue: {
            transaction: jest.fn((cb: (m: typeof manager) => unknown) =>
              Promise.resolve(cb(manager)),
            ),
          },
        },
        {
          provide: RbacSeederService,
          useValue: { seedSystemRoles: jest.fn() },
        },
        {
          provide: OwnerProvisioningService,
          useValue: {
            provisionOwner: jest.fn().mockResolvedValue({ token: 'tok' }),
            sendActivationEmail: jest.fn(),
          },
        },
        {
          provide: UserService,
          useValue: {
            findById: jest.fn((_ctx, id: string) =>
              Promise.resolve({ id, email: 'owner@test.com', name: 'Owner' }),
            ),
          },
        },
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
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalInterceptors(
      new ResponseEnvelopeInterceptor(app.get(Reflector)),
    );
    await app.init();

    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(async () => {
    await app.close();
  });

  // ===================== Authentication =====================

  describe('Authentication', () => {
    it('returns 401 without token', () => {
      return request(app.getHttpServer()).get('/organizations').expect(401);
    });
  });

  // ===================== GET /organizations =====================

  describe('GET /organizations', () => {
    it('ADMIN sees all tenants', async () => {
      tenantRepo.find.mockResolvedValue([
        makeTenant(),
        makeTenant({ id: '00000000-0000-0000-0000-000000000011' }),
      ]);

      const res = await request(app.getHttpServer())
        .get('/organizations')
        .set('Authorization', `Bearer ${adminToken()}`)
        .expect(200);

      expect((res.body as { data: unknown[] }).data).toHaveLength(2);
    });

    it('Regular USER sees only tenants with membership', async () => {
      membershipRepo.find.mockResolvedValue([{ orgId: TENANT_ID }]);
      tenantRepo.find.mockResolvedValue([makeTenant()]);

      const res = await request(app.getHttpServer())
        .get('/organizations')
        .set('Authorization', `Bearer ${userToken()}`)
        .expect(200);

      expect((res.body as { data: unknown[] }).data).toHaveLength(1);
    });
  });

  // ===================== GET /organizations/:id =====================

  describe('GET /organizations/:id', () => {
    it('ADMIN can view any tenant', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());

      await request(app.getHttpServer())
        .get(`/organizations/${TENANT_ID}`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .expect(200);
    });

    it('User with membership can view tenant', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());
      membershipRepo.findOne.mockResolvedValue({
        orgId: TENANT_ID,
        userId: USER_ID,
      });

      await request(app.getHttpServer())
        .get(`/organizations/${TENANT_ID}`)
        .set('Authorization', `Bearer ${userToken()}`)
        .expect(200);
    });

    it('User without membership gets 403', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());
      membershipRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get(`/organizations/${TENANT_ID}`)
        .set('Authorization', `Bearer ${userToken()}`)
        .expect(403);
    });

    it('Non-existent tenant returns 404', async () => {
      tenantRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get(`/organizations/${NONEXISTENT_ID}`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .expect(404);
    });
  });

  // ===================== POST /organizations =====================

  describe('POST /organizations', () => {
    it('ADMIN can create a tenant', async () => {
      const res = await request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ name: 'New School', slug: 'new_school' })
        .expect(201);

      expect((res.body as { success: boolean }).success).toBe(true);
    });

    it('Non-admin USER gets 403 (self-serve signup replaces this route)', async () => {
      await request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${userToken()}`)
        .send({ name: 'Other School', slug: 'other_school' })
        .expect(403);
    });
  });

  // ===================== PATCH /organizations/:id =====================

  describe('PATCH /organizations/:id', () => {
    it('ADMIN can update any tenant', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());
      tenantRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      await request(app.getHttpServer())
        .patch(`/organizations/${TENANT_ID}`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ name: 'Updated' })
        .expect(200);
    });

    it('Tenant OWNER can update their tenant', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());
      membershipRepo.findOne.mockResolvedValue({
        userId: OWNER_ID,
        role: MembershipRole.OWNER,
      });
      tenantRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      await request(app.getHttpServer())
        .patch(`/organizations/${TENANT_ID}`)
        .set('Authorization', `Bearer ${userToken(OWNER_ID)}`)
        .send({ name: 'Updated' })
        .expect(200);
    });

    it('Non-owner USER gets 403', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());
      membershipRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .patch(`/organizations/${TENANT_ID}`)
        .set('Authorization', `Bearer ${userToken()}`)
        .send({ name: 'Hacked' })
        .expect(403);
    });
  });

  // ===================== DELETE /organizations/:id =====================

  describe('DELETE /organizations/:id', () => {
    it('ADMIN can delete tenant', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant());

      await request(app.getHttpServer())
        .delete(`/organizations/${TENANT_ID}`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .expect(200);
    });

    it('Regular USER gets 403', () => {
      return request(app.getHttpServer())
        .delete(`/organizations/${TENANT_ID}`)
        .set('Authorization', `Bearer ${userToken()}`)
        .expect(403);
    });
  });
});
