import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { parseIdentifier } from '~/common/identity/identifier';
import { hashPassword } from '~/common/identity/password';
import { User } from '~/modules/users/entities/user.entity';
import { UserStatus } from '~/modules/users/enums/user-status.enum';
import { Membership } from '~/modules/memberships/entities/membership.entity';
import { MembershipStatus } from '~/modules/memberships/enums/membership-status.enum';

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;
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
  platformRole: true,
  emailVerifiedAt: true,
  mustChangePassword: true,
  failedLoginCount: true,
  lockedUntil: true,
} as const;

// Re-exported for the auth services that already import it from here.
export { hashPassword };

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

  /**
   * The account, if `password` is right and it isn't locked. Throws
   * 401 `Invalid credentials` (same answer for unknown accounts) or
   * {@link AccountLockedException}. `onFailure` sees every failure.
   *
   * Each attempt claims a slot in `failed_login_count` before the
   * password is compared, so parallel guesses can't all slip in before the
   * lock is set: at most {@link MAX_FAILED_LOGINS} are ever in flight, and
   * a right password that finishes after the lock started is refused.
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
    const attempt = await this.claimAttempt(user.id);
    if (attempt === null) {
      // Locked meanwhile, or the limit is used up by attempts in flight.
      throw new AccountLockedException(await this.lock(user.id));
    }
    if (!(await bcrypt.compare(password, user.password))) {
      const locked = attempt >= MAX_FAILED_LOGINS;
      const lockedUntil = locked ? await this.lock(user.id) : null;
      await onFailure?.({ userId: user.id, locked });
      if (lockedUntil) throw new AccountLockedException(lockedUntil);
      throw invalidCredentials();
    }
    const lockedUntil = await this.clearFailures(user.id);
    if (lockedUntil) throw new AccountLockedException(lockedUntil);
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

  /**
   * Whether the account signs in with a password its owner chose: active,
   * not on a temporary password, not Google-only (`password_set`), and
   * verified or active in some school.
   * Activation links must never replace such a password, or whoever holds
   * the link (an owner-transfer response, a forwarded email) would take
   * the account over. Reads memberships across schools (root connection).
   */
  async hasOwnPassword(userId: string): Promise<boolean> {
    const user = await this.users.findOne({
      where: { id: userId },
      select: {
        id: true,
        status: true,
        emailVerifiedAt: true,
        mustChangePassword: true,
        passwordSet: true,
      },
    });
    if (
      !user ||
      user.status !== UserStatus.ACTIVE ||
      user.mustChangePassword ||
      !user.passwordSet
    ) {
      return false;
    }
    if (user.emailVerifiedAt) return true;
    return this.users.manager.exists(Membership, {
      where: { userId, status: MembershipStatus.ACTIVE },
    });
  }

  /** Sets a password the user chose; clears the forced-change flag. */
  async setPassword(userId: string, password: string): Promise<void> {
    await this.users.update(userId, {
      password: await hashPassword(password),
      mustChangePassword: false,
      passwordSet: true,
      failedLoginCount: 0,
      lockedUntil: null,
    });
  }

  /**
   * Counts an attempt unless the account is locked or the limit is used
   * up; an expired lock is cleared on the way. Returns the attempt number,
   * or null when the attempt may not go ahead.
   */
  private async claimAttempt(userId: string): Promise<number | null> {
    const [row] = updatedRows<{ failed_login_count: number }>(
      await this.users.manager.query(
        `UPDATE "users" SET
         "failed_login_count" = CASE WHEN "locked_until" IS NULL THEN "failed_login_count" + 1 ELSE 1 END,
         "locked_until" = NULL
       WHERE "id" = $1
         AND ("locked_until" IS NULL OR "locked_until" <= now())
         AND ("failed_login_count" < $2 OR "locked_until" IS NOT NULL)
       RETURNING "failed_login_count"`,
        [userId, MAX_FAILED_LOGINS],
      ),
    );
    return row ? row.failed_login_count : null;
  }

  /** Starts the lock (keeping one already running) and resets the count. */
  private async lock(userId: string): Promise<Date> {
    const [row] = updatedRows<{ locked_until: Date }>(
      await this.users.manager.query(
        `UPDATE "users" SET
         "failed_login_count" = 0,
         "locked_until" = CASE WHEN "locked_until" > now() THEN "locked_until"
                               ELSE now() + make_interval(mins => $2) END
       WHERE "id" = $1
       RETURNING "locked_until"`,
        [userId, LOCK_MINUTES],
      ),
    );
    return new Date(row.locked_until);
  }

  /**
   * Resets the count after a right password, unless a lock started while
   * it was being checked; then returns that lock's end.
   */
  private async clearFailures(userId: string): Promise<Date | null> {
    const [row] = updatedRows<{ locked_until: Date | null }>(
      await this.users.manager.query(
        `UPDATE "users" SET "failed_login_count" = 0
         WHERE "id" = $1
         RETURNING "locked_until"`,
        [userId],
      ),
    );
    const until = row?.locked_until ? new Date(row.locked_until) : null;
    return until && until.getTime() > Date.now() ? until : null;
  }
}

/**
 * Rows of an `UPDATE … RETURNING` run through `manager.query`: TypeORM's
 * Postgres driver returns `[rows, rowCount]` for UPDATE (plain rows for
 * SELECT and INSERT).
 */
export function updatedRows<T>(result: unknown): T[] {
  return Array.isArray(result) && Array.isArray(result[0])
    ? (result[0] as T[])
    : (result as T[]);
}

function invalidCredentials() {
  return new UnauthorizedException({
    message: 'Invalid credentials',
    code: 'INVALID_CREDENTIALS',
  });
}
