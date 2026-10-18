import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PlatformUserController } from '~/modules/users/controllers/platform-user.controller';
import { UserService } from '~/modules/users/services/user.service';
import { User } from '~/modules/users/entities/user.entity';
import { PlatformJwtStrategy } from '~/modules/auth/strategies/platform-jwt.strategy';
import { UserStatus } from '~/modules/users/enums/user-status.enum';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ResponseEnvelopeInterceptor } from '~/common/interceptors/response-envelope.interceptor';

const JWT_SECRET = 'test-secret-key-for-e2e-testing-32chars!';

const ADMIN_ID = 'f8507227-7441-42b4-ba59-9b5d08e8b393';
const USER_ID = '32097309-2d93-492a-888d-ffb47743b86d';
const OTHER_USER_ID = '9b54cc23-ace4-4184-a6f5-781d34eea07a';

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: USER_ID,
    email: 'user@test.com',
    name: 'Test User',
    status: UserStatus.ACTIVE,
    isAdmin: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as User;

describe('User E2E', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let userRepo: Record<string, jest.Mock>;

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
    userRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((data: object) => ({ id: OTHER_USER_ID, ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule,
        JwtModule.register({
          secret: JWT_SECRET,
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [PlatformUserController],
      providers: [
        UserService,
        PlatformJwtStrategy,
        { provide: getRepositoryToken(User), useValue: userRepo },
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
      return request(app.getHttpServer()).get('/platform/users').expect(401);
    });
  });

  // ===================== GET /platform/users =====================

  describe('GET /platform/users', () => {
    it('ADMIN can list all users', async () => {
      userRepo.find.mockResolvedValue([makeUser()]);

      const res = await request(app.getHttpServer())
        .get('/platform/users')
        .set('Authorization', `Bearer ${adminToken()}`)
        .expect(200);

      expect((res.body as { data: unknown[] }).data).toHaveLength(1);
    });

    it('Regular USER gets 403', () => {
      return request(app.getHttpServer())
        .get('/platform/users')
        .set('Authorization', `Bearer ${userToken()}`)
        .expect(403);
    });
  });

  // ===================== GET /platform/users/:id =====================

  describe('GET /platform/users/:id', () => {
    it('ADMIN can view any user', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ id: OTHER_USER_ID }));

      await request(app.getHttpServer())
        .get(`/platform/users/${OTHER_USER_ID}`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .expect(200);
    });

    it('User can view own profile', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ id: USER_ID }));

      await request(app.getHttpServer())
        .get(`/platform/users/${USER_ID}`)
        .set('Authorization', `Bearer ${userToken()}`)
        .expect(200);
    });

    it('User cannot view another user', () => {
      return request(app.getHttpServer())
        .get(`/platform/users/${OTHER_USER_ID}`)
        .set('Authorization', `Bearer ${userToken()}`)
        .expect(403);
    });
  });

  // ===================== POST /platform/users =====================

  describe('POST /platform/users', () => {
    const dto = {
      email: 'new@test.com',
      password: 'password123',
      name: 'New User',
    };

    it('ADMIN can create user', async () => {
      userRepo.findOne
        .mockResolvedValueOnce(null) // email check
        .mockResolvedValueOnce(
          makeUser({ id: OTHER_USER_ID, email: 'new@test.com' }),
        ); // findById after save

      await request(app.getHttpServer())
        .post('/platform/users')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send(dto)
        .expect(201);
    });

    it('Regular USER gets 403', () => {
      return request(app.getHttpServer())
        .post('/platform/users')
        .set('Authorization', `Bearer ${userToken()}`)
        .send(dto)
        .expect(403);
    });
  });

  // ===================== PATCH /platform/users/:id =====================

  describe('PATCH /platform/users/:id', () => {
    it('User can update own profile', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ id: USER_ID }));
      userRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      await request(app.getHttpServer())
        .patch(`/platform/users/${USER_ID}`)
        .set('Authorization', `Bearer ${userToken()}`)
        .send({ name: 'Updated' })
        .expect(200);
    });

    it('User cannot update another user', () => {
      return request(app.getHttpServer())
        .patch(`/platform/users/${OTHER_USER_ID}`)
        .set('Authorization', `Bearer ${userToken()}`)
        .send({ name: 'Hacked' })
        .expect(403);
    });

    it('ADMIN can update any user', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ id: OTHER_USER_ID }));
      userRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      await request(app.getHttpServer())
        .patch(`/platform/users/${OTHER_USER_ID}`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ name: 'Updated' })
        .expect(200);
    });
  });

  // ===================== DELETE /platform/users/:id =====================

  describe('DELETE /platform/users/:id', () => {
    it('ADMIN can delete user', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());

      await request(app.getHttpServer())
        .delete(`/platform/users/${USER_ID}`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .expect(200);
    });

    it('Regular USER gets 403', () => {
      return request(app.getHttpServer())
        .delete(`/platform/users/${USER_ID}`)
        .set('Authorization', `Bearer ${userToken()}`)
        .expect(403);
    });
  });
});
