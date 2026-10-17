import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { MembershipController } from 'src/modules/platform/memberships/controllers/membership.controller';
import { MembershipService } from 'src/modules/platform/memberships/services/membership.service';
import { Membership } from 'src/modules/platform/memberships/entities/membership.entity';
import { MembershipRole } from 'src/modules/platform/memberships/enums/membership-role.enum';
import { OrganizationService } from 'src/modules/platform/organizations/services/organization.service';
import { UserService } from 'src/modules/platform/users/user.service';
import { PlatformJwtStrategy } from 'src/modules/platform/auth/platform-jwt.strategy';
import { UserStatus } from 'src/modules/platform/users/enums/user-status.enum';
import { ConfigService } from '@nestjs/config';
import { OwnerProvisioningService } from '~/tenanted/auth/owner-provisioning.service';

const JWT_SECRET = 'test-secret-key-for-e2e-testing-32chars!';

// Valid v4 UUIDs for testing
const ADMIN_ID = 'f8507227-7441-42b4-ba59-9b5d08e8b393';
const USER_ID = '32097309-2d93-492a-888d-ffb47743b86d';
const OWNER_ID = '9b54cc23-ace4-4184-a6f5-781d34eea07a';
const TARGET_USER_ID = '61cc357b-0e97-4091-91d3-f70b2f2578cd';
const TENANT_ID = '357c9a54-0107-40e6-b7c3-39885caa2b93';
const MEMBERSHIP_ID = '227adcb7-da65-47a0-8593-5fcd2399d569';

const makeMembership = (overrides: Partial<Membership> = {}): Membership =>
  ({
    id: MEMBERSHIP_ID,
    userId: USER_ID,
    orgId: TENANT_ID,
    role: MembershipRole.MEMBER,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Membership;

describe('Membership E2E', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let membershipRepo: Record<string, jest.Mock>;
  let tenantServiceMock: Record<string, jest.Mock>;
  let userServiceMock: Record<string, jest.Mock>;

  const adminToken = () =>
    jwtService.sign({
      sub: ADMIN_ID,
      email: 'admin@test.com',
      status: UserStatus.ACTIVE,
      isAdmin: true,
    });

  const userToken = (id = USER_ID) =>
    jwtService.sign({
      sub: id,
      email: 'user@test.com',
      status: UserStatus.ACTIVE,
      isAdmin: false,
    });

  beforeEach(async () => {
    membershipRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((data) => ({ id: MEMBERSHIP_ID, ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      delete: jest.fn(),
    };

    tenantServiceMock = {
      findById: jest.fn().mockResolvedValue({ id: TENANT_ID }),
    };

    userServiceMock = {
      findById: jest.fn().mockResolvedValue({ id: TARGET_USER_ID }),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule,
        JwtModule.register({
          secret: JWT_SECRET,
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [MembershipController],
      providers: [
        MembershipService,
        PlatformJwtStrategy,
        { provide: getRepositoryToken(Membership), useValue: membershipRepo },
        { provide: OrganizationService, useValue: tenantServiceMock },
        { provide: UserService, useValue: userServiceMock },
        {
          provide: getDataSourceToken(),
          useValue: {
            transaction: jest.fn(async (cb: any) =>
              cb({ delete: jest.fn(), findOneOrFail: jest.fn() }),
            ),
          },
        },
        {
          provide: OwnerProvisioningService,
          useValue: {
            provisionOwner: jest.fn().mockResolvedValue({ token: 'tok' }),
            sendActivationEmail: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => (key === 'jwt.secret' ? JWT_SECRET : null),
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
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
      return request(app.getHttpServer()).get('/memberships').expect(401);
    });

    it('returns 401 with invalid token', () => {
      return request(app.getHttpServer())
        .get('/memberships')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  // ===================== GET /memberships =====================

  describe('GET /memberships', () => {
    it('ADMIN sees all memberships', async () => {
      membershipRepo.find.mockResolvedValue([makeMembership()]);

      const res = await request(app.getHttpServer())
        .get('/memberships')
        .set('Authorization', `Bearer ${adminToken()}`)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
    });

    it('Regular USER sees only own memberships', async () => {
      membershipRepo.find.mockResolvedValue([
        makeMembership({ userId: USER_ID }),
      ]);

      const res = await request(app.getHttpServer())
        .get('/memberships')
        .set('Authorization', `Bearer ${userToken()}`)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
    });

    it('Regular USER querying another userId gets 403', () => {
      return request(app.getHttpServer())
        .get(`/memberships?userId=${TARGET_USER_ID}`)
        .set('Authorization', `Bearer ${userToken()}`)
        .expect(403);
    });
  });

  // ===================== GET /memberships/organization/:orgId =====================

  describe('GET /memberships/organization/:orgId', () => {
    it('ADMIN can list tenant memberships', async () => {
      membershipRepo.find.mockResolvedValue([makeMembership()]);

      await request(app.getHttpServer())
        .get(`/memberships/organization/${TENANT_ID}`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .expect(200);
    });

    it('Tenant OWNER can list their tenant memberships', async () => {
      membershipRepo.findOne.mockResolvedValue(
        makeMembership({ userId: OWNER_ID, role: MembershipRole.OWNER }),
      );
      membershipRepo.find.mockResolvedValue([makeMembership()]);

      await request(app.getHttpServer())
        .get(`/memberships/organization/${TENANT_ID}`)
        .set('Authorization', `Bearer ${userToken(OWNER_ID)}`)
        .expect(200);
    });

    it('Regular USER gets 403', async () => {
      membershipRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get(`/memberships/organization/${TENANT_ID}`)
        .set('Authorization', `Bearer ${userToken()}`)
        .expect(403);
    });
  });

  // ===================== GET /memberships/user/:userId =====================

  describe('GET /memberships/user/:userId', () => {
    it('User can query self', async () => {
      membershipRepo.find.mockResolvedValue([
        makeMembership({ userId: USER_ID }),
      ]);

      await request(app.getHttpServer())
        .get(`/memberships/user/${USER_ID}`)
        .set('Authorization', `Bearer ${userToken()}`)
        .expect(200);
    });

    it('User cannot query another user', () => {
      return request(app.getHttpServer())
        .get(`/memberships/user/${TARGET_USER_ID}`)
        .set('Authorization', `Bearer ${userToken()}`)
        .expect(403);
    });

    it('ADMIN can query any user', async () => {
      userServiceMock.findById.mockResolvedValue({ id: TARGET_USER_ID });
      membershipRepo.find.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get(`/memberships/user/${TARGET_USER_ID}`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .expect(200);
    });
  });

  // ===================== POST /memberships =====================

  describe('POST /memberships', () => {
    const dto = {
      userId: TARGET_USER_ID,
      orgId: TENANT_ID,
      role: MembershipRole.MEMBER,
    };

    it('ADMIN can create membership', async () => {
      membershipRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/memberships')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send(dto)
        .expect(201);
    });

    it('Tenant OWNER can create membership for their tenant', async () => {
      membershipRepo.findOne
        .mockResolvedValueOnce(
          makeMembership({ userId: OWNER_ID, role: MembershipRole.OWNER }),
        )
        .mockResolvedValueOnce(null);

      await request(app.getHttpServer())
        .post('/memberships')
        .set('Authorization', `Bearer ${userToken(OWNER_ID)}`)
        .send(dto)
        .expect(201);
    });

    it('Regular USER gets 403', async () => {
      membershipRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/memberships')
        .set('Authorization', `Bearer ${userToken()}`)
        .send(dto)
        .expect(403);
    });

    it('Tenant OWNER cannot create OWNER membership', async () => {
      membershipRepo.findOne.mockResolvedValue(
        makeMembership({ userId: OWNER_ID, role: MembershipRole.OWNER }),
      );

      await request(app.getHttpServer())
        .post('/memberships')
        .set('Authorization', `Bearer ${userToken(OWNER_ID)}`)
        .send({ ...dto, role: MembershipRole.OWNER })
        .expect(403);
    });
  });

  // ===================== PATCH /memberships/:id =====================

  describe('PATCH /memberships/:id', () => {
    it('ADMIN can update role to OWNER', async () => {
      membershipRepo.findOne
        .mockResolvedValueOnce(makeMembership({ role: MembershipRole.MEMBER }))
        // no other OWNER in the organization
        .mockResolvedValueOnce(null);
      membershipRepo.save.mockImplementation((entity) =>
        Promise.resolve(entity),
      );

      await request(app.getHttpServer())
        .patch(`/memberships/${MEMBERSHIP_ID}`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ role: MembershipRole.OWNER })
        .expect(200);
    });

    it('Tenant OWNER cannot promote to OWNER', async () => {
      membershipRepo.findOne
        .mockResolvedValueOnce(
          makeMembership({ role: MembershipRole.MEMBER, orgId: TENANT_ID }),
        )
        .mockResolvedValueOnce(
          makeMembership({
            userId: OWNER_ID,
            role: MembershipRole.OWNER,
            orgId: TENANT_ID,
          }),
        );

      await request(app.getHttpServer())
        .patch(`/memberships/${MEMBERSHIP_ID}`)
        .set('Authorization', `Bearer ${userToken(OWNER_ID)}`)
        .send({ role: MembershipRole.OWNER })
        .expect(403);
    });

    it('Non-owner gets 403', async () => {
      membershipRepo.findOne
        .mockResolvedValueOnce(makeMembership({ orgId: TENANT_ID }))
        .mockResolvedValueOnce(null);

      await request(app.getHttpServer())
        .patch(`/memberships/${MEMBERSHIP_ID}`)
        .set('Authorization', `Bearer ${userToken()}`)
        .send({ role: MembershipRole.ADMIN })
        .expect(403);
    });
  });

  // ===================== DELETE /memberships/:id =====================

  describe('DELETE /memberships/:id', () => {
    it('ADMIN can delete any membership', async () => {
      membershipRepo.findOne.mockResolvedValue(makeMembership());

      await request(app.getHttpServer())
        .delete(`/memberships/${MEMBERSHIP_ID}`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .expect(200);
    });

    it('Tenant OWNER cannot delete OWNER membership', async () => {
      membershipRepo.findOne
        .mockResolvedValueOnce(
          makeMembership({ role: MembershipRole.OWNER, orgId: TENANT_ID }),
        )
        .mockResolvedValueOnce(
          makeMembership({
            userId: OWNER_ID,
            role: MembershipRole.OWNER,
            orgId: TENANT_ID,
          }),
        );

      await request(app.getHttpServer())
        .delete(`/memberships/${MEMBERSHIP_ID}`)
        .set('Authorization', `Bearer ${userToken(OWNER_ID)}`)
        .expect(403);
    });

    it('Non-owner gets 403', async () => {
      membershipRepo.findOne
        .mockResolvedValueOnce(makeMembership({ orgId: TENANT_ID }))
        .mockResolvedValueOnce(null);

      await request(app.getHttpServer())
        .delete(`/memberships/${MEMBERSHIP_ID}`)
        .set('Authorization', `Bearer ${userToken()}`)
        .expect(403);
    });
  });
});
