import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import {
  EMAIL_VERIFICATION_TTL_MS,
  PASSWORD_RESET_TTL_MS,
} from '~/common/tokens/token-ttl.constants';
import { generateToken, hashToken } from '~/common/tokens/secure-token.util';
import { AuthTokenType } from '~/common/tokens/auth-token-type.enum';
import { MailService } from '~/shared/mail/mail.service';
import type { RequestWithOrg } from '~/tenancy/tenant.middleware';
import { AuthToken } from '~/platform/auth/entities/auth-token.entity';
import { Membership } from '~/platform/memberships/entities/membership.entity';
import { MembershipStatus } from '~/platform/memberships/enums/membership-status.enum';
import { User } from '~/platform/users/entities/user.entity';
import { UserStatus } from '~/platform/users/enums/user-status.enum';
import { UserRoleRepository } from '../rbac/user-role.repository';
import { AccountRepository } from '../users/account.repository';
import { MemberRepository } from '../users/member.repository';
import { LoginDto } from './dto/login.dto';
import { ActivateDto } from './dto/activate.dto';
import { AuthTokenRepository } from './auth-token.repository';
import type { TenantJwtPayload } from './jwt.strategy';

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
 * Tokens minted here carry the org id and are only redeemable in that org.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly accountRepo: AccountRepository,
    private readonly memberRepo: MemberRepository,
    private readonly userRoleRepo: UserRoleRepository,
    private readonly authTokenRepo: AuthTokenRepository,
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
      name: user.name,
      organization: this.organization,
    };
  }

  /**
   * Set the account password via an activation token, activate the
   * membership in this org, then sign in. Activation proves ownership of the
   * email, so the account is also marked verified.
   */
  async activate(dto: ActivateDto) {
    const { user, record } = await this.resolveToken(
      dto.token,
      AuthTokenType.ACTIVATION,
      'activation',
    );
    const membership = await this.memberRepo.findByUserId(user.id);
    if (!membership) {
      throw new BadRequestException('Invalid activation link');
    }

    user.password = await bcrypt.hash(dto.password, 10);
    user.emailVerifiedAt ??= new Date();
    if (user.status === UserStatus.PENDING) {
      user.status = UserStatus.ACTIVE;
    }
    await this.accountRepo.save(user);

    membership.status = MembershipStatus.ACTIVE;
    await this.memberRepo.save(membership);

    record.usedAt = new Date();
    await this.authTokenRepo.save(record);

    return this.generateToken(user, membership);
  }

  // --- Login / session -----------------------------------------------------

  async login(dto: LoginDto) {
    const { email, password } = dto;
    const user = await this.accountRepo.findByEmailWithPassword(email);
    if (!user?.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Valid credentials but not a member here: same answer as a bad password,
    // so the endpoint doesn't reveal which schools an email belongs to.
    const membership = await this.memberRepo.findByUserId(user.id);
    if (!membership) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (BLOCKED_ACCOUNT_STATUSES.has(user.status)) {
      throw new UnauthorizedException(`Account is ${user.status}`);
    }
    if (membership.status === MembershipStatus.PENDING) {
      throw new ForbiddenException(
        'Please activate your account using the link sent to your email.',
      );
    }
    if (membership.status !== MembershipStatus.ACTIVE) {
      throw new UnauthorizedException(`Membership is ${membership.status}`);
    }

    return this.generateToken(user, membership);
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
    const assignments = await this.userRoleRepo.findByUserId(userId);
    return assignments
      .map((assignment) => assignment.role?.name)
      .filter((name): name is string => !!name);
  }

  private async generateToken(user: User, membership: Membership) {
    const payload: TenantJwtPayload = {
      sub: user.id,
      email: user.email,
      orgId: membership.orgId,
      isAdmin: membership.isAdmin === true,
    };

    const roles = await this.getRoleNames(user.id);

    return {
      access_token: this.jwtService.sign(payload),
      token_type: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
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
  async checkVerificationToken(rawToken: string): Promise<{ email: string }> {
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
  // applies to every organization the user can sign in to.

  /** Mint + email a reset token if the member exists (always silent). */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.findMemberAccount(email);
    if (!user) return;

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
  async checkResetToken(rawToken: string): Promise<{ email: string }> {
    const { user } = await this.resolveToken(
      rawToken,
      AuthTokenType.PASSWORD_RESET,
      'reset',
    );
    return { email: user.email };
  }

  /** Consume a reset token and set the new password. */
  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const { user, record } = await this.resolveToken(
      rawToken,
      AuthTokenType.PASSWORD_RESET,
      'reset',
    );

    user.password = await bcrypt.hash(newPassword, 10);
    await this.accountRepo.save(user);

    record.usedAt = new Date();
    await this.authTokenRepo.save(record);
  }

  /** Change password for an authenticated user (verifies the current one). */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.accountRepo.findByIdWithPassword(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await this.accountRepo.save(user);
  }

  // --- Internals ----------------------------------------------------------

  /** The account for `email`, only if it is a member of this org. */
  private async findMemberAccount(email: string): Promise<User | null> {
    const user = await this.accountRepo.findByEmail(email);
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
    label: 'activation' | 'verification' | 'reset',
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
