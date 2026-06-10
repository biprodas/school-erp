import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import {
  EMAIL_VERIFICATION_TTL_MS,
  PASSWORD_RESET_TTL_MS,
} from '~/common/tokens/token-ttl.constants';
import { generateToken, hashToken } from '~/common/tokens/secure-token.util';
import { AuthTokenType } from '~/common/tokens/auth-token-type.enum';
import { MailService } from '~/shared/mail/mail.service';
import { User } from 'src/modules/platform/users/entities/user.entity';
import { UserStatus } from 'src/modules/platform/users/enums/user-status.enum';
import { PlatformRegisterDto } from './dto/platform-register.dto';
import { PlatformLoginDto } from './dto/platform-login.dto';
import { AuthToken } from './entities/auth-token.entity';

/**
 * Authentication + self-service account operations for platform users:
 * register/login plus email verification, password reset, and change-password.
 * Fully decoupled from the tenant activation/onboarding flow. Anti-enumeration:
 * forgot/resend never reveal whether an email exists.
 */
@Injectable()
export class PlatformAuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(AuthToken)
    private readonly tokenRepo: Repository<AuthToken>,
    private readonly mail: MailService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Self-registration. The user starts PENDING and must verify their email
   * before they can log in — no JWT is issued here.
   */
  async register(dto: PlatformRegisterDto) {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = this.userRepository.create({
      email: dto.email,
      password: hashedPassword,
      name: dto.name,
      status: UserStatus.PENDING,
    });
    await this.userRepository.save(user);

    await this.issueEmailVerification(user);

    return { email: user.email };
  }

  async login(dto: PlatformLoginDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
      select: [
        'id',
        'email',
        'password',
        'name',
        'status',
        'isAdmin',
        'emailVerifiedAt',
      ],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(dto.password, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Credentials are valid — now surface a clear reason if they can't log in.
    if (user.status === UserStatus.PENDING && !user.emailVerifiedAt) {
      throw new ForbiddenException(
        'Please verify your email before logging in.',
      );
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(`Account is ${user.status}`);
    }

    return this.buildTokenResponse(user);
  }

  async getProfile(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['memberships'],
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  // --- Email verification -------------------------------------------------

  /** Mint + email a verification token. Called by register() and resend. */
  async issueEmailVerification(user: User): Promise<void> {
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
  async checkVerificationToken(rawToken: string): Promise<{ email: string }> {
    const { user } = await this.resolveVerification(rawToken);
    return { email: user.email };
  }

  /** Consume a verification token: mark verified + active, then auto-login. */
  async verifyEmail(rawToken: string) {
    const { user, record } = await this.resolveVerification(rawToken);

    user.emailVerifiedAt = new Date();
    if (user.status === UserStatus.PENDING) {
      user.status = UserStatus.ACTIVE;
    }
    await this.userRepository.save(user);

    record.usedAt = new Date();
    await this.tokenRepo.save(record);

    return this.buildTokenResponse(user);
  }

  /** Re-issue a verification email if the user exists and is not yet verified. */
  async resendVerification(email: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (user && !user.emailVerifiedAt) {
      await this.issueEmailVerification(user);
    }
  }

  // --- Password reset / change -------------------------------------------

  /** Mint + email a reset token if the user exists (always silent). */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) return;

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
  async checkResetToken(rawToken: string): Promise<{ email: string }> {
    const { user } = await this.resolveReset(rawToken);
    return { email: user.email };
  }

  /** Consume a reset token and set the new password. */
  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const { user, record } = await this.resolveReset(rawToken);

    user.password = await bcrypt.hash(newPassword, 10);
    await this.userRepository.save(user);

    record.usedAt = new Date();
    await this.tokenRepo.save(record);
  }

  /** Change password for an authenticated user (verifies the current one). */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'email', 'password', 'name', 'status', 'isAdmin'],
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await this.userRepository.save(user);
  }

  // --- Internals ----------------------------------------------------------

  private buildTokenResponse(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      status: user.status,
      isAdmin: user.isAdmin,
    };
    return {
      access_token: this.jwtService.sign(payload),
      token_type: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
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
