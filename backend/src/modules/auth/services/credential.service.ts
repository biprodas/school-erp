import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { parseIdentifier } from '~/common/identity/identifier';
import { User } from '~/modules/users/entities/user.entity';

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;
const BCRYPT_COST = 10;
/** Compared against when no account matches, so timing doesn't reveal it. */
const DUMMY_HASH =
  '$2b$10$K3KmTcYrbcI/j3wvpB8cx.51wD9gVl2QXnoZeSpozS6.XPiL3svzy';

const WITH_PASSWORD = {
  id: true,
  email: true,
  phone: true,
  password: true,
  name: true,
  status: true,
  isAdmin: true,
  emailVerifiedAt: true,
  mustChangePassword: true,
  failedLoginCount: true,
  lockedUntil: true,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export class AccountLockedException extends UnauthorizedException {
  constructor(readonly lockedUntil: Date) {
    super({
      message: `Too many failed sign-ins. Try again after ${lockedUntil.toISOString()}.`,
      code: 'ACCOUNT_LOCKED',
      lockedUntil: lockedUntil.toISOString(),
    });
  }
}

/** Outcome of a failed password check, for the audit log. */
export interface FailedSignIn {
  userId: string | null;
  locked: boolean;
}

/**
 * Checks "email or phone + password" for both realms against the global
 * account. After {@link MAX_FAILED_LOGINS} wrong passwords in a row the
 * account is locked for {@link LOCK_MINUTES} minutes (PRD 6.3). Identity
 * data is global, so this uses the root connection.
 */
@Injectable()
export class CredentialService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /** The account a login identifier points at (no password loaded). */
  findByIdentifier(identifier: string): Promise<User | null> {
    const where = parseIdentifier(identifier);
    return where ? this.users.findOne({ where }) : Promise.resolve(null);
  }

  /**
   * The account, if `password` is right and it isn't locked. Throws
   * 401 `Invalid credentials` (same answer for unknown accounts) or
   * {@link AccountLockedException}. `onFailure` sees every failure.
   */
  async verify(
    identifier: string,
    password: string,
    onFailure?: (failure: FailedSignIn) => Promise<void> | void,
  ): Promise<User> {
    const where = parseIdentifier(identifier);
    const user = where
      ? await this.users.findOne({ where, select: WITH_PASSWORD })
      : null;
    if (!user?.password) {
      await bcrypt.compare(password, DUMMY_HASH);
      await onFailure?.({ userId: null, locked: false });
      throw invalidCredentials();
    }
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new AccountLockedException(user.lockedUntil);
    }
    if (!(await bcrypt.compare(password, user.password))) {
      const lockedUntil = await this.recordFailure(user.id);
      await onFailure?.({ userId: user.id, locked: !!lockedUntil });
      if (lockedUntil) throw new AccountLockedException(lockedUntil);
      throw invalidCredentials();
    }
    if (user.failedLoginCount > 0 || user.lockedUntil) {
      await this.users.update(user.id, {
        failedLoginCount: 0,
        lockedUntil: null,
      });
    }
    return user;
  }

  /** Checks a user's current password (change-password). */
  async checkPassword(userId: string, password: string): Promise<boolean> {
    const user = await this.users.findOne({
      where: { id: userId },
      select: { id: true, password: true },
    });
    return !!user?.password && bcrypt.compare(password, user.password);
  }

  /** Sets a password the user chose; clears the forced-change flag. */
  async setPassword(userId: string, password: string): Promise<void> {
    await this.users.update(userId, {
      password: await hashPassword(password),
      mustChangePassword: false,
      failedLoginCount: 0,
      lockedUntil: null,
    });
  }

  /**
   * One atomic step: count the failure and, at the limit, start the lock
   * (and reset the count). Returns the lock end when this failure locked it.
   */
  private async recordFailure(userId: string): Promise<Date | null> {
    const [row] = await this.users.manager.query<
      Array<{ locked_until: Date | null; failed_login_count: number }>
    >(
      `UPDATE "users" SET
         "failed_login_count" = CASE WHEN "failed_login_count" + 1 >= $2 THEN 0 ELSE "failed_login_count" + 1 END,
         "locked_until" = CASE WHEN "failed_login_count" + 1 >= $2 THEN now() + make_interval(mins => $3) ELSE "locked_until" END
       WHERE "id" = $1
       RETURNING "locked_until", "failed_login_count"`,
      [userId, MAX_FAILED_LOGINS, LOCK_MINUTES],
    );
    return row && row.failed_login_count === 0 && row.locked_until
      ? new Date(row.locked_until)
      : null;
  }
}

function invalidCredentials() {
  return new UnauthorizedException({
    message: 'Invalid credentials',
    code: 'INVALID_CREDENTIALS',
  });
}
