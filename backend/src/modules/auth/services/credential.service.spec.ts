import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { Repository } from 'typeorm';
import type { User } from '~/modules/users/entities/user.entity';
import {
  AccountLockedException,
  CredentialService,
  LOCK_MINUTES,
} from './credential.service';

describe('CredentialService', () => {
  let users: {
    findOne: jest.Mock;
    update: jest.Mock;
    manager: { query: jest.Mock };
  };
  let service: CredentialService;
  let hash: string;

  beforeAll(async () => {
    hash = await bcrypt.hash('right-password', 4);
  });

  const account = (overrides: Partial<User> = {}) =>
    ({
      id: 'user-1',
      email: 'rahim@school.test',
      password: hash,
      failedLoginCount: 0,
      lockedUntil: null,
      ...overrides,
    }) as User;

  beforeEach(() => {
    users = {
      findOne: jest.fn().mockResolvedValue(account()),
      update: jest.fn(),
      manager: {
        query: jest
          .fn()
          .mockResolvedValue([{ failed_login_count: 1, locked_until: null }]),
      },
    };
    service = new CredentialService(users as unknown as Repository<User>);
  });

  it('looks accounts up by normalized email or phone', async () => {
    await service.verify(' Rahim@School.TEST ', 'right-password');
    expect(users.findOne).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { email: 'rahim@school.test' } }),
    );

    await service.verify('01712-345678', 'right-password');
    expect(users.findOne).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { phone: '+8801712345678' } }),
    );
  });

  it('returns the account for the right password and clears old failures', async () => {
    users.findOne.mockResolvedValue(account({ failedLoginCount: 3 }));

    await expect(
      service.verify('rahim@school.test', 'right-password'),
    ).resolves.toMatchObject({ id: 'user-1' });
    expect(users.update).toHaveBeenCalledWith('user-1', {
      failedLoginCount: 0,
      lockedUntil: null,
    });
  });

  it('counts a wrong password and gives the generic answer', async () => {
    const onFailure = jest.fn();

    await expect(
      service.verify('rahim@school.test', 'wrong', onFailure),
    ).rejects.toThrow(UnauthorizedException);
    expect(users.manager.query).toHaveBeenCalledWith(
      expect.stringContaining('failed_login_count'),
      ['user-1', 5, LOCK_MINUTES],
    );
    expect(onFailure).toHaveBeenCalledWith({ userId: 'user-1', locked: false });
  });

  it('locks the account on the failure that reaches the limit', async () => {
    const until = new Date(Date.now() + LOCK_MINUTES * 60_000);
    users.manager.query.mockResolvedValue([
      { failed_login_count: 0, locked_until: until },
    ]);
    const onFailure = jest.fn();

    await expect(
      service.verify('rahim@school.test', 'wrong', onFailure),
    ).rejects.toBeInstanceOf(AccountLockedException);
    expect(onFailure).toHaveBeenCalledWith({ userId: 'user-1', locked: true });
  });

  it('refuses a locked account even with the right password', async () => {
    users.findOne.mockResolvedValue(
      account({ lockedUntil: new Date(Date.now() + 60_000) }),
    );

    await expect(
      service.verify('rahim@school.test', 'right-password'),
    ).rejects.toBeInstanceOf(AccountLockedException);
    expect(users.update).not.toHaveBeenCalled();
  });

  it('accepts the right password once the lock has expired', async () => {
    users.findOne.mockResolvedValue(
      account({ lockedUntil: new Date(Date.now() - 1000) }),
    );

    await expect(
      service.verify('rahim@school.test', 'right-password'),
    ).resolves.toBeDefined();
    expect(users.update).toHaveBeenCalledWith('user-1', {
      failedLoginCount: 0,
      lockedUntil: null,
    });
  });

  it('gives the same answer for an unknown account or an unusable identifier', async () => {
    users.findOne.mockResolvedValue(null);
    const onFailure = jest.fn();

    await expect(
      service.verify('nobody@school.test', 'x', onFailure),
    ).rejects.toThrow('Invalid credentials');
    await expect(service.verify('12', 'x')).rejects.toThrow(
      'Invalid credentials',
    );
    expect(onFailure).toHaveBeenCalledWith({ userId: null, locked: false });
    expect(users.manager.query).not.toHaveBeenCalled();
  });
});
