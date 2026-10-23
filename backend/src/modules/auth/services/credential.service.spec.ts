import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { Repository } from 'typeorm';
import type { User } from '~/modules/users/entities/user.entity';
import {
  AccountLockedException,
  CredentialService,
  LOCK_MINUTES,
  MAX_FAILED_LOGINS,
} from './credential.service';

describe('CredentialService', () => {
  let users: {
    findOne: jest.Mock;
    manager: { query: jest.Mock };
  };
  /** What the counter SQL answers: the claimed attempt, or null when refused. */
  let claimed: number | null;
  /** `locked_until` seen by the reset after a right password. */
  let lockedAtReset: Date | null;
  let service: CredentialService;
  let hash: string;
  const lockUntil = new Date(Date.now() + LOCK_MINUTES * 60_000);

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

  /** Which counter step ran, in order: claim, lock or clear. */
  const steps = () =>
    users.manager.query.mock.calls.map(([sql]: [string]) =>
      sql.includes('make_interval')
        ? 'lock'
        : sql.includes('"failed_login_count" < $2')
          ? 'claim'
          : 'clear',
    );

  beforeEach(() => {
    claimed = 1;
    lockedAtReset = null;
    users = {
      findOne: jest.fn().mockResolvedValue(account()),
      manager: {
        // Shaped like TypeORM's Postgres driver answers an UPDATE … RETURNING:
        // `[rows, rowCount]`, not the rows alone.
        query: jest.fn((sql: string) => {
          const updated = (rows: object[]) =>
            Promise.resolve([rows, rows.length]);
          if (sql.includes('make_interval')) {
            return updated([{ locked_until: lockUntil }]);
          }
          if (sql.includes('"failed_login_count" < $2')) {
            return updated(
              claimed === null ? [] : [{ failed_login_count: claimed }],
            );
          }
          return updated([{ locked_until: lockedAtReset }]);
        }),
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

  it('claims an attempt, then clears the count for the right password', async () => {
    await expect(
      service.verify('rahim@school.test', 'right-password'),
    ).resolves.toMatchObject({ id: 'user-1' });
    expect(steps()).toEqual(['claim', 'clear']);
    const [[, params]] = users.manager.query.mock.calls as [
      [string, unknown[]],
    ];
    expect(params).toEqual(['user-1', MAX_FAILED_LOGINS]);
  });

  it('counts a wrong password and gives the generic answer', async () => {
    const onFailure = jest.fn();

    await expect(
      service.verify('rahim@school.test', 'wrong', onFailure),
    ).rejects.toThrow(UnauthorizedException);
    expect(steps()).toEqual(['claim']);
    expect(onFailure).toHaveBeenCalledWith({ userId: 'user-1', locked: false });
  });

  it('locks the account on the failure that reaches the limit', async () => {
    claimed = MAX_FAILED_LOGINS;
    const onFailure = jest.fn();

    await expect(
      service.verify('rahim@school.test', 'wrong', onFailure),
    ).rejects.toBeInstanceOf(AccountLockedException);
    expect(steps()).toEqual(['claim', 'lock']);
    expect(onFailure).toHaveBeenCalledWith({ userId: 'user-1', locked: true });
  });

  it('refuses a locked account even with the right password', async () => {
    users.findOne.mockResolvedValue(
      account({ lockedUntil: new Date(Date.now() + 60_000) }),
    );

    await expect(
      service.verify('rahim@school.test', 'right-password'),
    ).rejects.toBeInstanceOf(AccountLockedException);
    expect(users.manager.query).not.toHaveBeenCalled();
  });

  it('refuses even the right password when attempts in flight used up the limit', async () => {
    claimed = null;

    await expect(
      service.verify('rahim@school.test', 'right-password'),
    ).rejects.toBeInstanceOf(AccountLockedException);
    expect(steps()).toEqual(['claim', 'lock']);
  });

  it('refuses a right password when a parallel guess locked the account meanwhile', async () => {
    lockedAtReset = lockUntil;

    await expect(
      service.verify('rahim@school.test', 'right-password'),
    ).rejects.toBeInstanceOf(AccountLockedException);
  });

  it('accepts the right password once the lock has expired', async () => {
    users.findOne.mockResolvedValue(
      account({ lockedUntil: new Date(Date.now() - 1000) }),
    );

    await expect(
      service.verify('rahim@school.test', 'right-password'),
    ).resolves.toBeDefined();
    expect(steps()).toEqual(['claim', 'clear']);
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
