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
import { CredentialService, hashPassword } from './credential.service';
import { SessionService, type IssuedSession } from './session.service';

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
    @Inject(REQUEST) private readonly request: RequestWithOrg,
    private readonly jwtService: JwtService,
  ) {}

  private get organization() {
    return { id: this.request.orgId, slug: this.request.orgSlug };
  }

  // --- Activation (provisioned owners / invited members) ------------------

  /** Validate an activation token and return the target user's details. */
  async verifyActivation(rawToken: string) {
    const { user } = await this.resolveToken(
      rawToken,
      AuthTokenType.ACTIVATION,
      'activation',
    );
    return {
      email: user.email,
      phone: user.phone,
      name: user.name,
      organization: this.organization,
    };
  }

  /**
   * Set the account password via an activation token, activate the
   * membership in this org, then sign in. Activation through an emailed link
   * proves ownership of the email, so the account is also marked verified.
   */
  async activate(dto: ActivateDto, client: ClientInfo) {
    const { user, record } = await this.resolveToken(
      dto.token,
      AuthTokenType.ACTIVATION,
      'activation',
    );
    const membership = await this.memberRepo.findByUserId(user.id);
    if (!membership) {
      throw new BadRequestException('Invalid activation link');
    }

    user.password = await hashPassword(dto.password);
    user.mustChangePassword = false;
    if (user.email) user.emailVerifiedAt ??= new Date();
    if (user.status === UserStatus.PENDING) {
      user.status = UserStatus.ACTIVE;
    }
    await this.accountRepo.save(user);

    membership.status = MembershipStatus.ACTIVE;
    await this.memberRepo.save(membership);

    record.usedAt = new Date();
    await this.authTokenRepo.save(record);

    return this.startSession(user, membership, client);
  }

  // --- Login / session -----------------------------------------------------

  async login(dto: LoginDto, client: ClientInfo) {
    const user = await this.credentials.verify(
      loginIdentifier(dto),
      dto.password,
    );
    const membership = await this.memberRepo.findByUserId(user.id);
    this.assertCanSignIn(user, membership);
    return this.startSession(user, membership, client);
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

    const membership = await this.memberRepo.findByUserId(user.id);
    this.assertCanSignIn(user, membership);
    return this.startSession(user, membership, client);
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

  logout(sessionId: string): Promise<void> {
    return this.sessions.revokeFamily(sessionId);
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
  }

  /** Signs the user out of every school and the platform. */
  logoutEverywhere(userId: string): Promise<void> {
    return this.sessions.revokeAllForUser(userId);
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
      throw new UnauthorizedException(`Account is ${user.status}`);
    }
    if (membership.status === MembershipStatus.PENDING) {
      throw new ForbiddenException({
        message: 'Please activate your account using your invitation link.',
        code: 'MEMBERSHIP_PENDING',
      });
    }
    if (membership.status !== MembershipStatus.ACTIVE) {
      throw new UnauthorizedException(`Membership is ${membership.status}`);
    }
  }

  async getMe(userId: string) {
    const membership = await this.memberRepo.findByUserId(userId);
    if (!membership) {
      throw new UnauthorizedException('User not found');
    }

    const { password: _password, ...account } = membership.user;
    const roles = await this.getRoleNames(userId);
    return {
      ...account,
      status: membership.status,
      isAdmin: membership.isAdmin,
      membershipId: membership.id,
      roles,
    };
  }

  private async getRoleNames(userId: string): Promise<string[]> {
    const roles = await this.roleService.getUserRoles(userId);
    return roles.map((role) => role.name);
  }

  private async startSession(
    user: User,
    membership: Membership,
    client: ClientInfo,
  ) {
    const session = await this.sessions.start(
      user.id,
      membership.orgId,
      client,
    );
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
    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException(`Invalid or expired ${label} link`);
    }
    const user = await this.accountRepo.findById(record.userId);
    if (!user) {
      throw new BadRequestException(`Invalid ${label} link`);
    }
    return { user, record };
  }
}
