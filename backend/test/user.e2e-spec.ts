import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserController } from 'src/modules/platform/users/user.controller';
import { UserService } from 'src/modules/platform/users/user.service';
import { User } from 'src/modules/platform/users/entities/user.entity';
import { PlatformJwtStrategy } from 'src/modules/platform/auth/platform-jwt.strategy';
import { PlatformRole } from 'src/modules/platform/users/enums/platform-role.enum';
import { UserStatus } from 'src/modules/platform/users/enums/user-status.enum';
import { ConfigService } from '@nestjs/config';

const JWT_SECRET = 'test-secret-key-for-e2e-testing-32chars!';

const ADMIN_ID = 'f8507227-7441-42b4-ba59-9b5d08e8b393';
const USER_ID = '32097309-2d93-492a-888d-ffb47743b86d';
const OTHER_USER_ID = '9b54cc23-ace4-4184-a6f5-781d34eea07a';

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: USER_ID,
    email: 'user@test.com',
    firstName: 'Test',
    lastName: 'User',
    fullName: 'Test User',
    role: PlatformRole.USER,
    status: UserStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as User;

describe('User E2E', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let userRepo: Record<string, jest.Mock>;

  const adminToken = () =>
    jwtService.sign({
      sub: ADMIN_ID,
      email: 'admin@test.com',
      role: PlatformRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    });

  const userToken = (id = USER_ID) =>
    jwtService.sign({
      sub: id,
      email: 'user@test.com',
      role: PlatformRole.USER,
      status: UserStatus.ACTIVE,
    });

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((data) => ({ id: OTHER_USER_ID, ...data })),
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
      controllers: [UserController],
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
    it('SUPER_ADMIN can list all users', async () => {
      userRepo.find.mockResolvedValue([makeUser()]);

      const res = await request(app.getHttpServer())
        .get('/platform/users')
        .set('Authorization', `Bearer ${adminToken()}`)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
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
    it('SUPER_ADMIN can view any user', async () => {
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
      firstName: 'New',
      lastName: 'User',
    };

    it('SUPER_ADMIN can create user', async () => {
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
        .send({ firstName: 'Updated' })
        .expect(200);
    });

    it('User cannot update another user', () => {
      return request(app.getHttpServer())
        .patch(`/platform/users/${OTHER_USER_ID}`)
        .set('Authorization', `Bearer ${userToken()}`)
        .send({ firstName: 'Hacked' })
        .expect(403);
    });

    it('SUPER_ADMIN can update any user', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ id: OTHER_USER_ID }));
      userRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      await request(app.getHttpServer())
        .patch(`/platform/users/${OTHER_USER_ID}`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ firstName: 'Updated' })
        .expect(200);
    });
  });

  // ===================== DELETE /platform/users/:id =====================

  describe('DELETE /platform/users/:id', () => {
    it('SUPER_ADMIN can delete user', async () => {
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
