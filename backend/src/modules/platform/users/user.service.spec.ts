import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { PlatformRole } from './enums/platform-role.enum';
import { UserStatus } from './enums/user-status.enum';
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

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-id',
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

// --- Test suite ---

describe('UserService', () => {
  let service: UserService;
  let userRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((data) => ({ id: 'new-user-id', ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  // ===================== findById =====================

  describe('findById', () => {
    it('returns user when found', async () => {
      const user = makeUser();
      userRepo.findOne.mockResolvedValue(user);

      const result = await service.findById(superAdminCtx(), 'user-id');
      expect(result.id).toBe('user-id');
    });

    it('throws NotFoundException when user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.findById(superAdminCtx(), 'bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ===================== createPlatformUser =====================

  describe('createPlatformUser', () => {
    const dto = {
      email: 'new@test.com',
      password: 'password123',
      firstName: 'New',
      lastName: 'User',
    };

    it('creates user with hashed password', async () => {
      userRepo.findOne
        .mockResolvedValueOnce(null) // email check
        .mockResolvedValueOnce(
          makeUser({ id: 'new-user-id', email: 'new@test.com' }),
        ); // findById after save

      const result = await service.createPlatformUser(superAdminCtx(), dto);
      expect(result).toBeDefined();
      expect(userRepo.create).toHaveBeenCalled();

      // Verify password was hashed (not plain text)
      const createArg = userRepo.create.mock.calls[0][0];
      expect(createArg.password).not.toBe('password123');
    });

    it('throws ConflictException for duplicate email', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());

      await expect(
        service.createPlatformUser(superAdminCtx(), dto),
      ).rejects.toThrow(ConflictException);
    });

    it('defaults to USER role and ACTIVE status', async () => {
      userRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeUser({ id: 'new-user-id' }));

      await service.createPlatformUser(superAdminCtx(), dto);

      const createArg = userRepo.create.mock.calls[0][0];
      expect(createArg.role).toBe(PlatformRole.USER);
      expect(createArg.status).toBe(UserStatus.ACTIVE);
    });
  });

  // ===================== update =====================

  describe('update', () => {
    it('SUPER_ADMIN can update any user', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ id: 'other-user' }));
      userRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.update(superAdminCtx(), 'other-user', {
        firstName: 'Updated',
      });
      expect(result.firstName).toBe('Updated');
    });

    it('SUPER_ADMIN can change role and status', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ id: 'other-user' }));
      userRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.update(superAdminCtx(), 'other-user', {
        role: PlatformRole.SUPER_ADMIN,
        status: UserStatus.SUSPENDED,
      });
      expect(result.role).toBe(PlatformRole.SUPER_ADMIN);
      expect(result.status).toBe(UserStatus.SUSPENDED);
    });

    it('User can update own profile', async () => {
      const ctx = userCtx('user-id');
      userRepo.findOne.mockResolvedValue(makeUser({ id: 'user-id' }));
      userRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.update(ctx, 'user-id', {
        firstName: 'Updated',
      });
      expect(result.firstName).toBe('Updated');
    });

    it('User cannot update others', async () => {
      const ctx = userCtx('user-id');

      await expect(
        service.update(ctx, 'other-user', { firstName: 'Hacked' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Non-admin cannot change role or status', async () => {
      const ctx = userCtx('user-id');

      await expect(
        service.update(ctx, 'user-id', { role: PlatformRole.SUPER_ADMIN }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Non-admin cannot change status', async () => {
      const ctx = userCtx('user-id');

      await expect(
        service.update(ctx, 'user-id', { status: UserStatus.SUSPENDED }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ===================== remove =====================

  describe('remove', () => {
    it('deletes existing user', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());

      await service.remove(superAdminCtx(), 'user-id');
      expect(userRepo.delete).toHaveBeenCalledWith('user-id');
    });

    it('throws NotFoundException for non-existent user', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.remove(superAdminCtx(), 'bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
