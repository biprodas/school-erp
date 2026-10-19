import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import type { ClientInfo } from '~/common/decorators/client.decorator';
import { normalizeEmail } from '~/common/identity/identifier';
import {
  EMAIL_VERIFICATION_TTL_MS,
  HANDOFF_TTL_MS,
  PASSWORD_RESET_TTL_MS,
} from '~/common/tokens/token-ttl.constants';
import { generateToken, hashToken } from '~/common/tokens/secure-token.util';
import { AuthTokenType } from '~/common/tokens/auth-token-type.enum';
import { MailService } from '~/shared/mail/mail.service';
import { User } from '~/modules/users/entities/user.entity';
import { UserStatus } from '~/modules/users/enums/user-status.enum';
import { Membership } from '~/modules/memberships/entities/membership.entity';
import { MembershipStatus } from '~/modules/memberships/enums/membership-status.enum';
import { Organization } from '~/modules/organizations/entities/organization.entity';
import { OrganizationStatus } from '~/modules/organizations/enums/organization-status.enum';
import { PlatformRegisterDto } from '../dto/platform-register.dto';
import { PlatformLoginDto } from '../dto/platform-login.dto';
import { loginIdentifier } from '../dto/login.dto';
import { AuthToken } from '../entities/auth-token.entity';
import type { PlatformJwtPayload } from '../strategies/platform-jwt.strategy';
import { CredentialService, hashPassword } from './credential.service';
import { SessionService, type IssuedSession } from './session.service';

/**
 * Authentication + self-service account operations for platform users:
 * register/login plus email verification, password reset, change-password
 * and sessions. Platform-issued tokens and sessions have a null `orgId`;
 * school-issued ones are never redeemable here. Anti-enumeration:
 * forgot/resend never reveal whether an email exists.
 */
@Injectable()
export class PlatformAuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(AuthToken)
    private readonly tokenRepo: Repository<AuthToken>,
    @InjectRepository(Membership)
    private readonly membershipRepo: Repository<Membership>,
    @InjectRepository(Organization)
    private readonly organizationRepo: Repository<Organization>,
    private readonly credentials: CredentialService,
    private readonly sessions: SessionService,
    private readonly mail: MailService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Self-registration. The user starts PENDING and must verify their email
   * before they can log in — no JWT is issued here.
   */
  async register(dto: PlatformRegisterDto) {
    const email = normalizeEmail(dto.email);
    const existing = await this.userRepository.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException({
        message: 'Email already registered',
        code: 'EMAIL_TAKEN',
      });
    }

    const user = this.userRepository.create({
      email,
      password: await hashPassword(dto.password),
      name: dto.name,
      status: UserStatus.PENDING,
    });
    await this.userRepository.save(user);

    await this.issueEmailVerification(user);

    return { email: user.email };
  }

  async login(dto: PlatformLoginDto, client: ClientInfo) {
    const user = await this.credentials.verify(
      loginIdentifier(dto),
      dto.password,
    );
    this.assertCanSignIn(user);
    return this.startSession(user, client);
  }

  async refresh(refreshToken: string, client: ClientInfo) {
    const rotated = await this.sessions.rotate(refreshToken, null, client);
    const user = await this.userRepository.findOne({
      where: { id: rotated.userId },
    });
    try {
      if (!user) throw new UnauthorizedException('Invalid credentials');
      this.assertCanSignIn(user);
    } catch (err) {
      await this.sessions.revokeFamily(rotated.sessionId);
      throw err;
    }
    return this.tokenResponse(user, rotated);
  }

  logout(sessionId: string): Promise<void> {
    return this.sessions.revokeFamily(sessionId);
  }

  listSessions(userId: string, currentSessionId: string) {
    return this.sessions.listActive(userId, null, currentSessionId);
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    if (!(await this.sessions.revokeOwn(userId, null, sessionId))) {
      throw new NotFoundException('Session not found');
    }
  }

  /** Signs the user out of the platform and every school. */
  logoutEverywhere(userId: string): Promise<void> {
    return this.sessions.revokeAllForUser(userId);
  }

  async getProfile(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { memberships: true },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  // --- Cross-host handoff --------------------------------------------------

  /**
   * Mint a single-use, short-lived code that signs the caller in to one of
   * their schools on that school's host (`POST /auth/handoff` there). The
   * token's `orgId` is the target org, so only that school can redeem it.
   * Every refusal gives the same answer, so this can't be used to probe
   * which schools exist or who belongs to them.
   */
  async issueHandoff(userId: string, orgId: string) {
    const [user, organization, membership] = await Promise.all([
      this.userRepository.findOne({ where: { id: userId } }),
      this.organizationRepo.findOne({ where: { id: orgId } }),
      this.membershipRepo.findOne({ where: { orgId, userId } }),
    ]);
    if (
      user?.status !== UserStatus.ACTIVE ||
      organization?.status !== OrganizationStatus.ACTIVE ||
      membership?.status !== MembershipStatus.ACTIVE
    ) {
      throw new ForbiddenException('You cannot sign in to this school');
    }

    const rawCode = generateToken();
    const expiresAt = new Date(Date.now() + HANDOFF_TTL_MS);
    await this.tokenRepo.save(
      this.tokenRepo.create({
        userId,
        orgId,
        tokenHash: hashToken(rawCode),
        type: AuthTokenType.HANDOFF,
        expiresAt,
        usedAt: null,
      }),
    );

    return { code: rawCode, orgSlug: organization.slug, expiresAt };
  }

  // --- Email verification -------------------------------------------------

  /** Mint + email a verification token. Called by register() and resend. */
  async issueEmailVerification(user: User): Promise<void> {
    if (!user.email) return;
    const rawToken = generateToken();
    const verificationToken = this.tokenRepo.create({
      userId: user.id,
      tokenHash: hashToken(rawToken),
      type: AuthTokenType.EMAIL_VERIFICATION,
      expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
      usedAt: null,
    });
    await this.tokenRepo.save(verificationToken);
    await this.mail.sendEmailVerificationEmail(user.email, user.name, rawToken);
  }

  /** Pre-check a verification token without consuming it (for the frontend). */
  async checkVerificationToken(
    rawToken: string,
  ): Promise<{ email: string | null }> {
    const { user } = await this.resolveVerification(rawToken);
    return { email: user.email };
  }

  /** Consume a verification token: mark verified + active, then auto-login. */
  async verifyEmail(rawToken: string, client: ClientInfo) {
    const { user, record } = await this.resolveVerification(rawToken);

    user.emailVerifiedAt = new Date();
    if (user.status === UserStatus.PENDING) {
      user.status = UserStatus.ACTIVE;
    }
    await this.userRepository.save(user);

    record.usedAt = new Date();
    await this.tokenRepo.save(record);

    return this.startSession(user, client);
  }

  /** Re-issue a verification email if the user exists and is not yet verified. */
  async resendVerification(email: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { email: normalizeEmail(email) },
    });
    if (user && !user.emailVerifiedAt) {
      await this.issueEmailVerification(user);
    }
  }

  // --- Password reset / change -------------------------------------------

  /** Mint + email a reset token if the user exists (always silent). */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { email: normalizeEmail(email) },
    });
    if (!user?.email) return;

    const rawToken = generateToken();
    const resetToken = this.tokenRepo.create({
      userId: user.id,
      tokenHash: hashToken(rawToken),
      type: AuthTokenType.PASSWORD_RESET,
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      usedAt: null,
    });
    await this.tokenRepo.save(resetToken);
    await this.mail.sendPasswordResetEmail(user.email, user.name, rawToken);
  }

  /** Pre-check a reset token without consuming it (for the frontend). */
  async checkResetToken(rawToken: string): Promise<{ email: string | null }> {
    const { user } = await this.resolveReset(rawToken);
    return { email: user.email };
  }

  /** Consume a reset token, set the new password, end every session. */
  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const { user, record } = await this.resolveReset(rawToken);

    await this.credentials.setPassword(user.id, newPassword);
    record.usedAt = new Date();
    await this.tokenRepo.save(record);
    await this.sessions.revokeAllForUser(user.id);
  }

  /**
   * Change password for an authenticated user (verifies the current one).
   * Other sessions end; this one gets a fresh access token.
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

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');
    return {
      access_token: this.accessToken(user, sessionId),
      token_type: 'Bearer',
    };
  }

  // --- Internals ----------------------------------------------------------

  /** Credentials are valid; surface a clear reason if they can't log in. */
  private assertCanSignIn(user: User): void {
    if (user.status === UserStatus.PENDING && !user.emailVerifiedAt) {
      throw new ForbiddenException({
        message: 'Please verify your email before logging in.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(`Account is ${user.status}`);
    }
  }

  private async startSession(user: User, client: ClientInfo) {
    const session = await this.sessions.start(user.id, null, client);
    return this.tokenResponse(user, session);
  }

  private accessToken(user: User, sessionId: string): string {
    const payload: PlatformJwtPayload = {
      sub: user.id,
      status: user.status,
      isAdmin: user.isAdmin,
      sid: sessionId,
      ...(user.mustChangePassword ? { mcp: true } : {}),
    };
    return this.jwtService.sign(payload);
  }

  private tokenResponse(user: User, session: IssuedSession) {
    return {
      access_token: this.accessToken(user, session.sessionId),
      refresh_token: session.refreshToken,
      refresh_expires_at: session.refreshExpiresAt,
      token_type: 'Bearer',
      mustChangePassword: user.mustChangePassword === true,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        name: user.name,
        status: user.status,
        isAdmin: user.isAdmin,
      },
    };
  }

  private async resolveVerification(
    rawToken: string,
  ): Promise<{ user: User; record: AuthToken }> {
    const record = await this.tokenRepo.findOne({
      where: {
        tokenHash: hashToken(rawToken),
        type: AuthTokenType.EMAIL_VERIFICATION,
        orgId: IsNull(),
      },
    });
    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Invalid or expired verification link');
    }
    const user = await this.userRepository.findOne({
      where: { id: record.userId },
    });
    if (!user) {
      throw new BadRequestException('Invalid verification link');
    }
    return { user, record };
  }

  private async resolveReset(
    rawToken: string,
  ): Promise<{ user: User; record: AuthToken }> {
    const record = await this.tokenRepo.findOne({
      where: {
        tokenHash: hashToken(rawToken),
        type: AuthTokenType.PASSWORD_RESET,
        orgId: IsNull(),
      },
    });
    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Invalid or expired reset link');
    }
    const user = await this.userRepository.findOne({
      where: { id: record.userId },
    });
    if (!user) {
      throw new BadRequestException('Invalid reset link');
    }
    return { user, record };
  }
}
