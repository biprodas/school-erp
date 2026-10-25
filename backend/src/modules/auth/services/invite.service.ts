import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { randomInt } from 'node:crypto';
import { AuthTokenType } from '~/common/tokens/auth-token-type.enum';
import { generateToken, hashToken } from '~/common/tokens/secure-token.util';
import { ACTIVATION_TTL_MS } from '~/common/tokens/token-ttl.constants';
import { hashPassword } from '~/common/identity/password';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';
import { AuditService } from '~/modules/audit/services/audit.service';
import { MembershipStatus } from '~/modules/memberships/enums/membership-status.enum';
import type {
  GUARDIAN_ROLE_NAME,
  STUDENT_ROLE_NAME,
} from '~/modules/rbac/system-roles.seed';
import { AccountRepository } from '~/modules/users/repositories/account.repository';
import { MemberRepository } from '~/modules/users/repositories/member.repository';
import { SettingsService } from '~/modules/settings/services/settings.service';
import { OrgUserService } from '~/modules/users/services/org-user.service';
import { MailService } from '~/shared/mail/mail.service';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import type { RequestWithOrg } from '~/tenancy/tenant.middleware';
import { InviteUserDto } from '../dto/invite-user.dto';
import { AuthTokenRepository } from '../repositories/auth-token.repository';
import { CredentialService } from './credential.service';
import { SessionService } from './session.service';

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

export interface ProvisionInput {
  name: string;
  email?: string;
  phone?: string;
  /** Staff roles, checked against the inviter's own permissions. */
  roleIds?: string[];
  /** Or a portal role (guardian/student), given without that check. */
  portalRole?: typeof GUARDIAN_ROLE_NAME | typeof STUDENT_ROLE_NAME;
  /**
   * `active`: the membership works at once and email holders still get an
   * activation link to choose a password (portal accounts made by the
   * school). `pending` (default): it activates with the link (invites).
   */
  membership?: 'active' | 'pending';
  /** Phone-only: give a slip password now (default) or none yet. */
  phoneSlip?: boolean;
  /** Already a member here: add the roles instead of refusing. */
  linkExistingMember?: boolean;
}

export type ProvisionDelivery =
  | 'email'
  | 'slip'
  | 'existing_account'
  | 'existing_member'
  /** Phone only, no slip yet: `issueSlip` later (SMS arrives in 1b). */
  | 'none';

export interface ProvisionResult {
  userId: string;
  delivery: ProvisionDelivery;
  temporaryPassword?: string;
  activationExpiresAt?: Date;
  /**
   * Sends the activation email, if any. Call it after the caller's
   * transaction commits, so no email ever names a rolled-back account.
   */
  sendMail: () => Promise<void>;
}

const noMail = () => Promise.resolve();

/** What `issueSlips` did for one account. */
export type SlipOutcome =
  | { status: 'issued'; identifier: string; temporaryPassword: string }
  | { status: 'own_password' | 'has_email'; identifier: string };

/**
 * Gives people a sign-in at this school without anyone choosing their
 * password (PRD 6.3): new accounts with an email get an activation link,
 * phone-only ones a temporary password for a printed slip, which must be
 * changed at first sign-in (SMS invites arrive in Phase 1b). Existing
 * accounts are linked and keep their password.
 */
@Injectable()
export class InviteService {
  constructor(
    private readonly orgUsers: OrgUserService,
    private readonly authTokenRepo: AuthTokenRepository,
    private readonly accounts: AccountRepository,
    private readonly members: MemberRepository,
    private readonly credentials: CredentialService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly settings: SettingsService,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
    @Inject(REQUEST) private readonly request: RequestWithOrg,
  ) {}

  /** `POST /users/invite`: pending membership, mail sent after commit. */
  async invite(dto: InviteUserDto): Promise<InviteResult> {
    const result = await this.provision({
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      roleIds: dto.roleIds,
    });
    await result.sendMail();
    switch (result.delivery) {
      case 'email':
        return {
          userId: result.userId,
          delivery: 'email',
          activationExpiresAt: result.activationExpiresAt!,
        };
      case 'slip':
        return {
          userId: result.userId,
          delivery: 'slip',
          temporaryPassword: result.temporaryPassword!,
        };
      default:
        return { userId: result.userId, delivery: 'existing_account' };
    }
  }

  /**
   * Adds someone to this school (see {@link ProvisionInput}). Runs in the
   * caller's transaction when there is one (a savepoint), so imports can
   * provision many people at once; the email goes out through `sendMail`.
   */
  provision(input: ProvisionInput): Promise<ProvisionResult> {
    return this.ds.runInTransaction(async () => {
      if (input.linkExistingMember) {
        const existing = await this.findMember(input);
        if (existing) {
          await this.orgUsers.addRoles(
            existing,
            input.roleIds,
            input.portalRole,
          );
          return {
            userId: existing,
            delivery: 'existing_member',
            sendMail: noMail,
          };
        }
      }

      const active = input.membership === 'active';
      const slipPassword =
        !input.email && (input.phoneSlip ?? true)
          ? temporaryPassword()
          : undefined;
      const added = await this.orgUsers.addMember({
        name: input.name,
        email: input.email,
        phone: input.phone,
        // Phone-only: usable right away with the slip password.
        password: slipPassword,
        status:
          active || slipPassword || !input.email
            ? MembershipStatus.ACTIVE
            : MembershipStatus.PENDING,
        roleIds: input.roleIds,
        portalRole: input.portalRole,
      });
      if (!added.createdAccount) {
        // Existing account: no link or slip, it already has a password.
        await this.orgUsers.activateMembership(added.userId);
        return {
          userId: added.userId,
          delivery: 'existing_account',
          sendMail: noMail,
        };
      }
      if (!input.email) {
        return slipPassword
          ? {
              userId: added.userId,
              delivery: 'slip',
              temporaryPassword: slipPassword,
              sendMail: noMail,
            }
          : { userId: added.userId, delivery: 'none', sendMail: noMail };
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
      const email = added.account.email!;
      const slug = this.request.orgSlug!;
      // Written in the school's language: the inviter's own may not be theirs.
      const { language } = await this.settings.getSection('locale');
      return {
        userId: added.userId,
        delivery: 'email',
        activationExpiresAt: expiresAt,
        sendMail: () =>
          this.mail.sendActivationEmail(
            email,
            input.name,
            rawToken,
            slug,
            language,
          ),
      };
    });
  }

  /**
   * A new one-time password for a member who has no password of their own
   * yet (phone-only guardians and students), for a printed slip. Refused
   * once they have chosen one: the school never resets that here.
   */
  async issueSlip(userId: string): Promise<{ temporaryPassword: string }> {
    if (!(await this.members.findByUserId(userId))) {
      throw new NotFoundException('Member not found');
    }
    if (await this.credentials.hasOwnPassword(userId)) {
      throw new ConflictException({
        message: 'This person already has their own password',
        code: 'PASSWORD_ALREADY_SET',
      });
    }
    const password = temporaryPassword();
    await this.ds.runInTransaction(async () => {
      await this.accounts.setTemporaryPassword(
        userId,
        await hashPassword(password),
      );
      await this.audit.record({
        action: AUDIT_ACTIONS.SLIP_ISSUED,
        entityType: 'user',
        entityId: userId,
      });
    });
    // Whoever held an older slip is out.
    await this.sessions.revokeAllForUser(userId);
    return { temporaryPassword: password };
  }

  /**
   * `issueSlip` for many accounts (a section's printed slips). Accounts with
   * their own password are skipped, and so are accounts with an email
   * unless `includeEmailAccounts` (they can use their activation link).
   * One account at a time, each in its own transaction, as for one slip.
   */
  async issueSlips(
    userIds: string[],
    { includeEmailAccounts = false } = {},
  ): Promise<Map<string, SlipOutcome>> {
    const outcomes = new Map<string, SlipOutcome>();
    const accounts = await this.accounts.findByIds([...new Set(userIds)]);
    for (const account of accounts) {
      const identifier = account.phone ?? account.email ?? '';
      if (account.email && !includeEmailAccounts) {
        outcomes.set(account.id, { status: 'has_email', identifier });
        continue;
      }
      if (await this.credentials.hasOwnPassword(account.id)) {
        outcomes.set(account.id, { status: 'own_password', identifier });
        continue;
      }
      const { temporaryPassword } = await this.issueSlip(account.id);
      outcomes.set(account.id, {
        status: 'issued',
        identifier,
        temporaryPassword,
      });
    }
    return outcomes;
  }

  /** The id of this school's member with the email or phone, if any. */
  private async findMember(input: ProvisionInput): Promise<string | null> {
    const account =
      (input.email && (await this.accounts.findByIdentifier(input.email))) ||
      (input.phone && (await this.accounts.findByIdentifier(input.phone))) ||
      null;
    if (!account) return null;
    return (await this.members.findByUserId(account.id)) ? account.id : null;
  }
}
