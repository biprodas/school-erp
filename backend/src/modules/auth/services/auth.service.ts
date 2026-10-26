import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '~/modules/organizations/entities/organization.entity';
import type { ClientInfo } from '~/common/decorators/client.decorator';
import { normalizeEmail } from '~/common/identity/identifier';
import {
  EMAIL_VERIFICATION_TTL_MS,
  PASSWORD_RESET_TTL_MS,
} from '~/common/tokens/token-ttl.constants';
import { generateToken, hashToken } from '~/common/tokens/secure-token.util';
import { AuthTokenType } from '~/common/tokens/auth-token-type.enum';
import { MailService } from '~/shared/mail/mail.service';
import type { RequestWithOrg } from '~/tenancy/tenant.middleware';
import { AuthToken } from '../entities/auth-token.entity';
import { Membership } from '~/modules/memberships/entities/membership.entity';
import { MembershipStatus } from '~/modules/memberships/enums/membership-status.enum';
import { User } from '~/modules/users/entities/user.entity';
import { UserStatus } from '~/modules/users/enums/user-status.enum';
import { RoleService } from '~/modules/rbac/services/role.service';
import { AccountRepository } from '~/modules/users/repositories/account.repository';
import { MemberRepository } from '~/modules/users/repositories/member.repository';
import { LoginDto, loginIdentifier } from '../dto/login.dto';
import { ActivateDto } from '../dto/activate.dto';
import { AuthTokenRepository } from '../repositories/auth-token.repository';
import type { TenantJwtPayload } from '../strategies/jwt.strategy';
import {
  CredentialService,
  hashPassword,
  LOCK_MINUTES,
  type FailedSignIn,
} from './credential.service';
import { AuditService } from '~/modules/audit/services/audit.service';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';
import { signInRefusalReason } from './sign-in-audit';
import { SessionService, type IssuedSession } from './session.service';
import { IdentityService } from './identity.service';
import { EntitlementService } from '~/modules/plans/services/entitlement.service';

/** Global account states that may never sign in, in any organization. */
const BLOCKED_ACCOUNT_STATUSES = new Set<string>([
  UserStatus.SUSPENDED,
  UserStatus.DEACTIVATED,
  UserStatus.BANNED,
]);

/**
 * Authentication inside one organization. Credentials belong to the global
 * user account (one login across schools); access additionally requires an
 * ACTIVE membership in the request's org, which also supplies `isAdmin`.
 * Tokens minted here carry the org id and are only redeemable in that org;
 * each sign-in is a session (refresh-token family) of this org.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly accountRepo: AccountRepository,
    private readonly memberRepo: MemberRepository,
    private readonly roleService: RoleService,
    private readonly authTokenRepo: AuthTokenRepository,
    private readonly credentials: CredentialService,
    private readonly sessions: SessionService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly identities: IdentityService,
    private readonly entitlements: EntitlementService,
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
    @Inject(REQUEST) private readonly request: RequestWithOrg,
    private readonly jwtService: JwtService,
  ) {}

  private get organization() {
    return { id: this.request.orgId, slug: this.request.orgSlug };
  }

  // --- Activation (provisioned owners / invited members) ------------------

  /**
   * Check an activation link without using it, and describe the invitation:
   * who it is for, what they will be in the school (roles, school admin)
   * and until when the link works. A membership suspended or removed since
   * the invitation is refused here as activating would refuse it.
   */
  async verifyActivation(rawToken: string) {
    const { user, record } = await this.resolveToken(
      rawToken,
      AuthTokenType.ACTIVATION,
      'activation',
    );
    const membership = await this.activatableMembership(user.id);
    return {
      email: user.email,
      phone: user.phone,
      name: user.name,
      organization: this.organization,
      // True: the account keeps its password, which activation asks for.
      hasPassword: await this.credentials.hasOwnPassword(user.id),
      isAdmin: membership.isAdmin,
      roles: await this.getRoleNames(user.id),
      expiresAt: record.expiresAt,
    };
  }

  /**
   * Accept an invitation (provisioned owners, invited members) and sign in.
   * A new account sets its password here; activation through an emailed
   * link proves ownership of the email, so it is also marked verified. An
   * account that already has its own password keeps it: the password in
   * the request must be that one (with the usual lockout), so the link
   * alone never takes over an account. Only a pending membership is
   * activated, and the link is consumed atomically.
   */
  async activate(dto: ActivateDto, client: ClientInfo) {
    const { user, record } = await this.resolveToken(
      dto.token,
      AuthTokenType.ACTIVATION,
      'activation',
    );
    const membership = await this.activatableMembership(user.id);

    const keepsPassword = await this.credentials.hasOwnPassword(user.id);
    if (keepsPassword) {
      const identifier = (user.email ?? user.phone)!;
      await this.credentials.verify(identifier, dto.password, (failure) =>
        this.recordFailedPassword(identifier, failure),
      );
    }
    if (!(await this.authTokenRepo.consume(record.id))) {
      throw new BadRequestException('Invalid or expired activation link');
    }

    if (!keepsPassword) {
      user.password = await hashPassword(dto.password);
      user.mustChangePassword = false;
      user.passwordSet = true;
      if (user.email) user.emailVerifiedAt ??= new Date();
      if (user.status === UserStatus.PENDING) {
        user.status = UserStatus.ACTIVE;
      }
      await this.accountRepo.save(user);
      // Whoever knew the previous (temporary or unverified) password is out.
      await this.sessions.revokeAllForUser(user.id);
    }

    if (membership.status === MembershipStatus.PENDING) {
      membership.status = MembershipStatus.ACTIVE;
      await this.memberRepo.save(membership);
    }

    await this.audit.record({
      action: AUDIT_ACTIONS.ACCOUNT_ACTIVATED,
      entityType: 'user',
      entityId: user.id,
      actorUserId: user.id,
      after: { passwordSet: !keepsPassword },
    });
    return this.startSession(user, membership, client, 'activation');
  }

  // --- Login / session -----------------------------------------------------

  async login(dto: LoginDto, client: ClientInfo) {
    const identifier = loginIdentifier(dto);
    const user = await this.credentials.verify(
      identifier,
      dto.password,
      (failure) => this.recordFailedPassword(identifier, failure),
    );
    const membership = await this.assertCanSignInAudited(
      user,
      await this.memberRepo.findByUserId(user.id),
      'password',
      { identifier },
    );
    return this.startSession(user, membership, client, 'password');
  }

  /**
   * Redeem a single-use handoff code (issued by the platform for this org)
   * for a tenant session. The repository is org-scoped, so a code issued for
   * another school is never found here.
   */
  async exchangeHandoff(rawCode: string, client: ClientInfo) {
    const { user, record } = await this.resolveToken(
      rawCode,
      AuthTokenType.HANDOFF,
      'sign-in',
    );
    if (!(await this.authTokenRepo.consume(record.id))) {
      throw new BadRequestException('Invalid or expired sign-in link');
    }

    const membership = await this.assertCanSignInAudited(
      user,
      await this.memberRepo.findByUserId(user.id),
      'handoff',
    );
    return this.startSession(user, membership, client, 'handoff');
  }

  /**
   * New token pair for a refresh token of this school. Re-reads the account
   * and membership, so role, admin and status changes apply right away; a
   * user who may no longer sign in loses the session.
   */
  async refresh(refreshToken: string, client: ClientInfo) {
    const rotated = await this.sessions.rotate(
      refreshToken,
      this.request.orgId!,
      client,
    );
    const user = await this.accountRepo.findById(rotated.userId);
    const membership = user
      ? await this.memberRepo.findByUserId(user.id)
      : null;
    try {
      if (!user) throw new UnauthorizedException('Invalid credentials');
      this.assertCanSignIn(user, membership);
    } catch (err) {
      await this.sessions.revokeFamily(rotated.sessionId);
      throw err;
    }
    return this.tokenResponse(user, membership, rotated);
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessions.revokeFamily(sessionId);
    await this.audit.record({
      action: AUDIT_ACTIONS.LOGOUT,
      entityType: 'session',
      entityId: sessionId,
    });
  }

  /** The user's active sign-ins on this school's host. */
  listSessions(userId: string, currentSessionId: string) {
    return this.sessions.listActive(
      userId,
      this.request.orgId!,
      currentSessionId,
    );
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    if (
      !(await this.sessions.revokeOwn(userId, this.request.orgId!, sessionId))
    ) {
      throw new NotFoundException('Session not found');
    }
    await this.audit.record({
      action: AUDIT_ACTIONS.SESSION_REVOKED,
      entityType: 'session',
      entityId: sessionId,
    });
  }

  /** Signs the user out of every school and the platform. */
  async logoutEverywhere(userId: string): Promise<void> {
    await this.sessions.revokeAllForUser(userId);
    await this.audit.record({
      action: AUDIT_ACTIONS.LOGOUT_ALL,
      entityType: 'user',
      entityId: userId,
    });
  }

  /**
   * A wrong password (or unknown account). Only members of this school are
   * named in its log: for anyone else the row is anonymous, so the log never
   * reveals which accounts exist elsewhere.
   */
  private async recordFailedPassword(
    identifier: string,
    failure: FailedSignIn,
  ): Promise<void> {
    const memberId =
      failure.userId && (await this.memberRepo.findByUserId(failure.userId))
        ? failure.userId
        : null;
    await this.audit.record({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      actorUserId: memberId,
      after: {
        method: 'password',
        identifier: identifier.trim().slice(0, 128),
        reason: memberId ? 'wrong_password' : 'unknown_account',
        ...(memberId && failure.locked ? { locked: true } : {}),
      },
    });
    if (memberId && failure.locked) {
      await this.audit.record({
        action: AUDIT_ACTIONS.ACCOUNT_LOCKED,
        entityType: 'user',
        entityId: memberId,
        actorUserId: memberId,
        after: { lockMinutes: LOCK_MINUTES },
      });
    }
  }

  /**
   * `assertCanSignIn`, recording a refusal as a failed sign-in. Returns the
   * (now known to exist) membership.
   */
  private async assertCanSignInAudited(
    user: User,
    membership: Membership | null,
    method: 'password' | 'handoff',
    details: Record<string, unknown> = {},
  ): Promise<Membership> {
    try {
      this.assertCanSignIn(user, membership);
      return membership;
    } catch (err) {
      await this.audit.record({
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        actorUserId: membership ? user.id : null,
        after: {
          method,
          ...details,
          reason: membership ? signInRefusalReason(err) : 'unknown_account',
        },
      });
      throw err;
    }
  }

  /** Account and membership checks shared by every way of signing in. */
  private assertCanSignIn(
    user: User,
    membership: Membership | null,
  ): asserts membership is Membership {
    // Valid credentials but not a member here: same answer as a bad password,
    // so the endpoint doesn't reveal which schools an account belongs to.
    if (!membership) {
      throw new UnauthorizedException({
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
      });
    }
    if (BLOCKED_ACCOUNT_STATUSES.has(user.status)) {
      throw new UnauthorizedException({
        message: `Account is ${user.status}`,
        code: `ACCOUNT_${user.status.toUpperCase()}`,
      });
    }
    if (membership.status === MembershipStatus.PENDING) {
      throw new ForbiddenException({
        message: 'Please activate your account using your invitation link.',
        code: 'MEMBERSHIP_PENDING',
      });
    }
    // Registered on the platform but never verified: nobody has proved
    // they own the email, so the account can't open a school session.
    if (user.status === UserStatus.PENDING) {
      throw new ForbiddenException({
        message: 'Please verify your email or use your invitation link.',
        code: 'ACCOUNT_PENDING',
      });
    }
    if (membership.status !== MembershipStatus.ACTIVE) {
      throw new UnauthorizedException({
        message: `Membership is ${membership.status}`,
        code: `MEMBERSHIP_${membership.status.toUpperCase()}`,
      });
    }
  }

  async getMe(userId: string) {
    const membership = await this.memberRepo.findByUserId(userId);
    if (!membership) {
      throw new UnauthorizedException('User not found');
    }

    const { password: _password, ...account } = membership.user;
    const [roles, permissions, identities, org, plan] = await Promise.all([
      this.getRoleNames(userId),
      this.roleService.effectivePermissions(
        userId,
        membership.isAdmin === true,
      ),
      this.identities.list(userId),
      this.organizations.findOne({
        where: { id: membership.orgId },
        select: {
          id: true,
          slug: true,
          name: true,
          status: true,
          onboardingCompletedAt: true,
        },
      }),
      this.entitlements.summary(membership.orgId),
    ]);
    return {
      ...account,
      status: membership.status,
      isAdmin: membership.isAdmin,
      membershipId: membership.id,
      roles,
      // For UI gating only; every endpoint still checks its own permission.
      permissions,
      identities,
      // The frontend's onboarding gate (doc/domains-and-routing.md 4.5).
      organization: {
        id: membership.orgId,
        slug: org?.slug ?? this.request.orgSlug,
        name: org?.name ?? null,
        status: org?.status ?? null,
        onboardingCompletedAt: org?.onboardingCompletedAt ?? null,
      },
      // For hiding or badging features outside the plan; guards still decide.
      plan,
    };
  }

  /** The invitee's membership here, while it may still be activated. */
  private async activatableMembership(userId: string): Promise<Membership> {
    const membership = await this.memberRepo.findByUserId(userId);
    if (!membership) {
      throw new BadRequestException({
        message: 'Invalid activation link',
        code: 'LINK_INVALID',
      });
    }
    if (
      membership.status !== MembershipStatus.PENDING &&
      membership.status !== MembershipStatus.ACTIVE
    ) {
      throw new ForbiddenException({
        message: `Membership is ${membership.status}`,
        code: `MEMBERSHIP_${membership.status.toUpperCase()}`,
      });
    }
    return membership;
  }

  private async getRoleNames(userId: string): Promise<string[]> {
    const roles = await this.roleService.getUserRoles(userId);
    return roles.map((role) => role.name);
  }

  private async startSession(
    user: User,
    membership: Membership,
    client: ClientInfo,
    method: 'password' | 'handoff' | 'activation',
  ) {
    const session = await this.sessions.start(
      user.id,
      membership.orgId,
      client,
    );
    await this.audit.record({
      action: AUDIT_ACTIONS.LOGIN,
      entityType: 'session',
      entityId: session.sessionId,
      actorUserId: user.id,
      after: { method },
    });
    return this.tokenResponse(user, membership, session);
  }

  private accessToken(user: User, membership: Membership, sessionId: string) {
    const payload: TenantJwtPayload = {
      sub: user.id,
      orgId: membership.orgId,
      isAdmin: membership.isAdmin === true,
      sid: sessionId,
      ...(user.mustChangePassword ? { mcp: true } : {}),
    };
    return this.jwtService.sign(payload);
  }

  private async tokenResponse(
    user: User,
    membership: Membership,
    session: IssuedSession,
  ) {
    const roles = await this.getRoleNames(user.id);
    return {
      access_token: this.accessToken(user, membership, session.sessionId),
      refresh_token: session.refreshToken,
      refresh_expires_at: session.refreshExpiresAt,
      token_type: 'Bearer',
      mustChangePassword: user.mustChangePassword === true,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        name: user.name,
        roles,
        status: membership.status,
        isAdmin: membership.isAdmin === true,
      },
      organization: this.organization,
    };
  }

  // --- Email verification (non-blocking) ---------------------------------

  /** Mint + email a verification token (link carries the org slug). */
  async issueEmailVerification(user: User): Promise<void> {
    if (!user.email) return;
    const rawToken = generateToken();
    await this.authTokenRepo.saveNew({
      userId: user.id,
      tokenHash: hashToken(rawToken),
      type: AuthTokenType.EMAIL_VERIFICATION,
      expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
      usedAt: null,
    });
    await this.mail.sendEmailVerificationEmail(
      user.email,
      user.name,
      rawToken,
      this.request.orgSlug,
    );
  }

  /** Pre-check a verification token without consuming it. */
  async checkVerificationToken(
    rawToken: string,
  ): Promise<{ email: string | null }> {
    const { user } = await this.resolveToken(
      rawToken,
      AuthTokenType.EMAIL_VERIFICATION,
      'verification',
    );
    return { email: user.email };
  }

  /** Consume a verification token and flag the user verified (non-blocking). */
  async verifyEmail(rawToken: string) {
    const { user, record } = await this.resolveToken(
      rawToken,
      AuthTokenType.EMAIL_VERIFICATION,
      'verification',
    );

    user.emailVerifiedAt = new Date();
    await this.accountRepo.save(user);

    record.usedAt = new Date();
    await this.authTokenRepo.save(record);

    return { email: user.email, emailVerifiedAt: user.emailVerifiedAt };
  }

  /** Re-issue a verification email if the member exists and isn't verified. */
  async resendVerification(email: string): Promise<void> {
    const user = await this.findMemberAccount(email);
    if (user && !user.emailVerifiedAt) {
      await this.issueEmailVerification(user);
    }
  }

  // --- Password reset / change -------------------------------------------
  // The password belongs to the global account, so a reset/change here
  // applies to every organization the user can sign in to. Phone-only
  // accounts reset through a school admin until SMS OTP arrives (PRD 6.3).

  /** Mint + email a reset token if the member exists (always silent). */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.findMemberAccount(email);
    if (!user?.email) return;

    const rawToken = generateToken();
    await this.authTokenRepo.saveNew({
      userId: user.id,
      tokenHash: hashToken(rawToken),
      type: AuthTokenType.PASSWORD_RESET,
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      usedAt: null,
    });
    await this.mail.sendPasswordResetEmail(
      user.email,
      user.name,
      rawToken,
      this.request.orgSlug,
    );
  }

  /** Pre-check a reset token without consuming it. */
  async checkResetToken(rawToken: string): Promise<{ email: string | null }> {
    const { user } = await this.resolveToken(
      rawToken,
      AuthTokenType.PASSWORD_RESET,
      'reset',
    );
    return { email: user.email };
  }

  /**
   * Consume a reset token and set the new password. Every existing session
   * of the account ends: whoever knew the old password is signed out.
   */
  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const { user, record } = await this.resolveToken(
      rawToken,
      AuthTokenType.PASSWORD_RESET,
      'reset',
    );

    await this.credentials.setPassword(user.id, newPassword);
    record.usedAt = new Date();
    await this.authTokenRepo.save(record);
    await this.sessions.revokeAllForUser(user.id);
    await this.audit.record({
      action: AUDIT_ACTIONS.PASSWORD_RESET,
      entityType: 'user',
      entityId: user.id,
      actorUserId: user.id,
    });
  }

  /**
   * Change password for an authenticated user (verifies the current one).
   * Other sessions end; this one continues with a fresh access token (which
   * also lifts a pending forced change).
   */
  async changePassword(
    userId: string,
    sessionId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    if (!(await this.credentials.checkPassword(userId, currentPassword))) {
      throw new BadRequestException({
        message: 'Current password is incorrect',
        code: 'WRONG_PASSWORD',
      });
    }
    await this.credentials.setPassword(userId, newPassword);
    await this.sessions.revokeAllForUser(userId, sessionId);
    await this.audit.record({
      action: AUDIT_ACTIONS.PASSWORD_CHANGED,
      entityType: 'user',
      entityId: userId,
    });

    const membership = await this.memberRepo.findByUserId(userId);
    if (!membership) throw new UnauthorizedException('User not found');
    return {
      access_token: this.accessToken(membership.user, membership, sessionId),
      token_type: 'Bearer',
    };
  }

  // --- Internals ----------------------------------------------------------

  /** The account for `email`, only if it is a member of this org. */
  private async findMemberAccount(email: string): Promise<User | null> {
    const user = await this.accountRepo.findByEmail(normalizeEmail(email));
    if (!user) return null;
    return (await this.memberRepo.findByUserId(user.id)) ? user : null;
  }

  /**
   * Resolves an unused, unexpired token of `type` issued by this org (the
   * repository is org-scoped) to its user account.
   */
  private async resolveToken(
    rawToken: string,
    type: AuthTokenType,
    label: 'activation' | 'verification' | 'reset' | 'sign-in',
  ): Promise<{ user: User; record: AuthToken }> {
    const record = await this.authTokenRepo.findByHash(
      hashToken(rawToken),
      type,
    );
    // Which way a link fails is told only to whoever holds it, so the page
    // can say what to do next (sign in, ask for a new one).
    if (!record) {
      throw new BadRequestException({
        message: `Invalid ${label} link`,
        code: 'LINK_INVALID',
      });
    }
    if (record.usedAt) {
      throw new BadRequestException({
        message: `This ${label} link was already used`,
        code: 'LINK_USED',
      });
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException({
        message: `This ${label} link has expired`,
        code: 'LINK_EXPIRED',
      });
    }
    const user = await this.accountRepo.findById(record.userId);
    if (!user) {
      throw new BadRequestException({
        message: `Invalid ${label} link`,
        code: 'LINK_INVALID',
      });
    }
    return { user, record };
  }
}
