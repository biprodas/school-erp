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
import { PlatformRole } from '~/modules/users/enums/platform-role.enum';
import { RequestContextDto } from '~/common/dto/request-context.dto';
import { SessionService } from '~/modules/auth/services/session.service';

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
      platformRole: PlatformRole.SUPER_ADMIN,
    },
  });

const adminCtx = () =>
  makeCtx({
    userId: 'plain-admin-id',
    user: {
      id: 'plain-admin-id',
      email: 'ops@test.com',
      status: UserStatus.ACTIVE,
      platformRole: PlatformRole.ADMIN,
    },
  });

const userCtx = (id = 'user-id') =>
  makeCtx({
    userId: id,
    user: {
      id,
      email: 'user@test.com',
      status: UserStatus.ACTIVE,
      platformRole: PlatformRole.USER,
    },
  });

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-id',
    email: 'user@test.com',
    name: 'Test User',
    status: UserStatus.ACTIVE,
    platformRole: PlatformRole.USER,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as User;

// --- Test suite ---

describe('UserService', () => {
  let service: UserService;
  let userRepo: Record<string, jest.Mock>;
  const sessions = {
    revokeAllForUser: jest.fn(),
    revokeAllForUserInOrg: jest.fn(),
  };

  beforeEach(async () => {
    sessions.revokeAllForUser.mockClear();
    sessions.revokeAllForUserInOrg.mockClear();
    userRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((data: object) => ({ id: 'new-user-id', ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      delete: jest.fn(),
      // Other active super admins (the last-super-admin check).
      count: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: SessionService, useValue: sessions },
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

    it('Super admin can change status and platform role', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ id: 'other-user' }));
      userRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.update(superAdminCtx(), 'other-user', {
        status: UserStatus.SUSPENDED,
        platformRole: PlatformRole.SUPPORT,
      });
      expect(result.status).toBe(UserStatus.SUSPENDED);
      expect(result.platformRole).toBe(PlatformRole.SUPPORT);
      // A suspended account is signed out everywhere.
      expect(sessions.revokeAllForUser).toHaveBeenCalledWith('other-user');
    });

    it('signs out a user whose role changes, not a renamed one', async () => {
      userRepo.save.mockImplementation((entity) => Promise.resolve(entity));
      userRepo.findOne.mockResolvedValue(makeUser({ id: 'u2' }));
      await service.update(superAdminCtx(), 'u2', { name: 'Renamed' });
      expect(sessions.revokeAllForUser).not.toHaveBeenCalled();

      userRepo.findOne.mockResolvedValue(
        makeUser({ id: 'u2', platformRole: PlatformRole.ADMIN }),
      );
      await service.update(superAdminCtx(), 'u2', {
        platformRole: PlatformRole.SUPPORT,
      });
      expect(sessions.revokeAllForUser).toHaveBeenCalledWith('u2');
    });

    it('an admin (not super admin) cannot change roles or edit others', async () => {
      await expect(
        service.update(adminCtx(), 'other-user', {
          platformRole: PlatformRole.SUPER_ADMIN,
        }),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.update(adminCtx(), 'plain-admin-id', {
          platformRole: PlatformRole.SUPER_ADMIN,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('nobody changes their own role or status', async () => {
      await expect(
        service.update(superAdminCtx(), 'admin-id', {
          platformRole: PlatformRole.USER,
        }),
      ).rejects.toMatchObject({
        response: { code: 'CANNOT_CHANGE_OWN_ACCESS' },
      });
    });

    it('keeps the last active super admin', async () => {
      userRepo.count.mockResolvedValue(0);
      userRepo.findOne.mockResolvedValue(
        makeUser({ id: 'u3', platformRole: PlatformRole.SUPER_ADMIN }),
      );
      await expect(
        service.update(superAdminCtx(), 'u3', {
          platformRole: PlatformRole.ADMIN,
        }),
      ).rejects.toMatchObject({ response: { code: 'LAST_SUPER_ADMIN' } });
      await expect(
        service.update(superAdminCtx(), 'u3', {
          status: UserStatus.SUSPENDED,
        }),
      ).rejects.toThrow(ConflictException);
      expect(userRepo.save).not.toHaveBeenCalled();

      // A rename isn't a demotion.
      await service.update(superAdminCtx(), 'u3', { name: 'Still super' });
      expect(userRepo.save).toHaveBeenCalled();
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

    it('Non-admin cannot change platform role', async () => {
      const ctx = userCtx('user-id');

      await expect(
        service.update(ctx, 'user-id', {
          platformRole: PlatformRole.SUPER_ADMIN,
        }),
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
      expect(sessions.revokeAllForUser).toHaveBeenCalledWith('user-id');
    });

    it('refuses removing yourself or the last super admin', async () => {
      await expect(
        service.remove(superAdminCtx(), 'admin-id'),
      ).rejects.toMatchObject({
        response: { code: 'CANNOT_CHANGE_OWN_ACCESS' },
      });

      userRepo.count.mockResolvedValue(0);
      userRepo.findOne.mockResolvedValue(
        makeUser({ id: 'u3', platformRole: PlatformRole.SUPER_ADMIN }),
      );
      await expect(service.remove(superAdminCtx(), 'u3')).rejects.toMatchObject(
        { response: { code: 'LAST_SUPER_ADMIN' } },
      );
      expect(userRepo.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for non-existent user', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.remove(superAdminCtx(), 'bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
