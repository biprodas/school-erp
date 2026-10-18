import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserService } from './user.service';
import { User } from '../entities/user.entity';
import { UserStatus } from '../enums/user-status.enum';
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

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-id',
    email: 'user@test.com',
    name: 'Test User',
    status: UserStatus.ACTIVE,
    isAdmin: false,
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
      create: jest.fn((data: object) => ({ id: 'new-user-id', ...data })),
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
      name: 'New User',
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
      const [[createArg]] = userRepo.create.mock.calls as [
        [{ password: string; status: UserStatus }],
      ];
      expect(createArg.password).not.toBe('password123');
    });

    it('throws ConflictException for duplicate email', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());

      await expect(
        service.createPlatformUser(superAdminCtx(), dto),
      ).rejects.toThrow(ConflictException);
    });

    it('defaults to ACTIVE status', async () => {
      userRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeUser({ id: 'new-user-id' }));

      await service.createPlatformUser(superAdminCtx(), dto);

      const [[createArg]] = userRepo.create.mock.calls as [
        [{ password: string; status: UserStatus }],
      ];
      expect(createArg.status).toBe(UserStatus.ACTIVE);
    });
  });

  // ===================== update =====================

  describe('update', () => {
    it('Admin can update any user', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ id: 'other-user' }));
      userRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.update(superAdminCtx(), 'other-user', {
        name: 'Updated',
      });
      expect(result.name).toBe('Updated');
    });

    it('Admin can change status and admin flag', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ id: 'other-user' }));
      userRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.update(superAdminCtx(), 'other-user', {
        status: UserStatus.SUSPENDED,
        isAdmin: true,
      });
      expect(result.status).toBe(UserStatus.SUSPENDED);
      expect(result.isAdmin).toBe(true);
    });

    it('User can update own profile', async () => {
      const ctx = userCtx('user-id');
      userRepo.findOne.mockResolvedValue(makeUser({ id: 'user-id' }));
      userRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.update(ctx, 'user-id', {
        name: 'Updated',
      });
      expect(result.name).toBe('Updated');
    });

    it('User cannot update others', async () => {
      const ctx = userCtx('user-id');

      await expect(
        service.update(ctx, 'other-user', { name: 'Hacked' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Non-admin cannot change admin flag', async () => {
      const ctx = userCtx('user-id');

      await expect(
        service.update(ctx, 'user-id', { isAdmin: true }),
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
