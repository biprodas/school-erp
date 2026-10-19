import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { randomInt } from 'node:crypto';
import { AuthTokenType } from '~/common/tokens/auth-token-type.enum';
import { generateToken, hashToken } from '~/common/tokens/secure-token.util';
import { ACTIVATION_TTL_MS } from '~/common/tokens/token-ttl.constants';
import { MembershipStatus } from '~/modules/memberships/enums/membership-status.enum';
import { OrgUserService } from '~/modules/users/services/org-user.service';
import { MailService } from '~/shared/mail/mail.service';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import type { RequestWithOrg } from '~/tenancy/tenant.middleware';
import { InviteUserDto } from '../dto/invite-user.dto';
import { AuthTokenRepository } from '../repositories/auth-token.repository';

/** No 0/O, 1/l/I: the password is read off a printed slip. */
const SLIP_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

export function temporaryPassword(length = 10): string {
  return Array.from(
    { length },
    () => SLIP_ALPHABET[randomInt(SLIP_ALPHABET.length)],
  ).join('');
}

export type InviteResult =
  /** An activation link was emailed; the membership is pending until used. */
  | { userId: string; delivery: 'email'; activationExpiresAt: Date }
  /** Phone only: hand the user this one-time password (shown only now). */
  | { userId: string; delivery: 'slip'; temporaryPassword: string }
  /** The person already has an account: they sign in with it. */
  | { userId: string; delivery: 'existing_account' };

/**
 * Adds someone to this school without the admin choosing their password
 * (PRD 6.3): new accounts with an email get an activation link, phone-only
 * ones a temporary password for a printed slip, which must be changed at
 * first sign-in (SMS invites arrive in Phase 1b). Existing accounts are
 * linked and keep their password.
 */
@Injectable()
export class InviteService {
  constructor(
    private readonly orgUsers: OrgUserService,
    private readonly authTokenRepo: AuthTokenRepository,
    private readonly mail: MailService,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
    @Inject(REQUEST) private readonly request: RequestWithOrg,
  ) {}

  async invite(dto: InviteUserDto): Promise<InviteResult> {
    const slipPassword = dto.email ? undefined : temporaryPassword();
    const outcome = await this.ds.runInTransaction(async () => {
      const added = await this.orgUsers.addMember({
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        // Phone-only: usable right away with the slip password.
        password: slipPassword,
        status: slipPassword
          ? MembershipStatus.ACTIVE
          : MembershipStatus.PENDING,
        roleIds: dto.roleIds,
      });
      if (!added.createdAccount) {
        // Existing account: no link or slip, it already has a password.
        await this.orgUsers.activateMembership(added.userId);
        return { kind: 'existing' as const, userId: added.userId };
      }
      if (slipPassword) {
        return { kind: 'slip' as const, userId: added.userId };
      }
      const rawToken = generateToken();
      const expiresAt = new Date(Date.now() + ACTIVATION_TTL_MS);
      await this.authTokenRepo.saveNew({
        userId: added.userId,
        tokenHash: hashToken(rawToken),
        type: AuthTokenType.ACTIVATION,
        expiresAt,
        usedAt: null,
      });
      return {
        kind: 'email' as const,
        userId: added.userId,
        rawToken,
        expiresAt,
        email: added.account.email!,
      };
    });

    switch (outcome.kind) {
      case 'existing':
        return { userId: outcome.userId, delivery: 'existing_account' };
      case 'slip':
        return {
          userId: outcome.userId,
          delivery: 'slip',
          temporaryPassword: slipPassword!,
        };
      case 'email':
        // After commit, so a failed send never leaves a half-made member.
        await this.mail.sendActivationEmail(
          outcome.email,
          dto.name,
          outcome.rawToken,
          this.request.orgSlug!,
        );
        return {
          userId: outcome.userId,
          delivery: 'email',
          activationExpiresAt: outcome.expiresAt,
        };
    }
  }
}
