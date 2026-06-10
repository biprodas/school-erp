import {
  BadRequestException,
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
import type { RequestWithTenant } from '~/tenancy/tenant.middleware';
import { UserRoleRepository } from '../rbac/user-role.repository';
import { UserRepository } from '../users/user.repository';
import { User } from '../users/entities/user.entity';
import { UserStatus } from '../users/enums/user-status.enum';
import { LoginDto } from './dto/login.dto';
import { ActivateDto } from './dto/activate.dto';
import { ActivationToken } from './entities/activation-token.entity';
import { ActivationTokenRepository } from './activation-token.repository';
import { AuthToken } from './entities/auth-token.entity';
import { AuthTokenRepository } from './auth-token.repository';
import { hashActivationToken } from './owner-provisioning.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly userRoleRepo: UserRoleRepository,
    private readonly activationTokenRepo: ActivationTokenRepository,
    private readonly authTokenRepo: AuthTokenRepository,
    private readonly mail: MailService,
    @Inject(REQUEST) private readonly request: RequestWithTenant,
    private readonly jwtService: JwtService,
  ) {}

  private get tenantSlug(): string | undefined {
    return this.request.tenantSlug;
  }

  /** Validate an activation token and return the target user's details. */
  async verifyActivation(rawToken: string) {
    const { user } = await this.resolveActivation(rawToken);
    return {
      email: user.email,
      name: user.name,
      tenant: {
        id: this.request.tenantId,
        slug: this.request.tenantSlug,
        schema: this.request.tenantSchema,
      },
    };
  }

  /** Set a pending user's password via their activation token, then sign in. */
  async activate(dto: ActivateDto) {
    const { user, record } = await this.resolveActivation(dto.token);

    user.password = await bcrypt.hash(dto.password, 10);
    user.status = UserStatus.ACTIVE;
    await this.userRepo.save(user);

    record.usedAt = new Date();
    await this.activationTokenRepo.save(record);

    return this.generateToken(user);
  }

  private async resolveActivation(
    rawToken: string,
  ): Promise<{ user: User; record: ActivationToken }> {
    const record = await this.activationTokenRepo.findByHash(
      hashActivationToken(rawToken),
    );
    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Invalid or expired activation link');
    }
    const user = await this.userRepo.findById(record.userId);
    if (!user) {
      throw new BadRequestException('Invalid activation link');
    }
    return { user, record };
  }

  async login(dto: LoginDto) {
    const { email, password } = dto;
    const user = await this.userRepo.findByEmailWithPassword(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateToken(user);
  }

  async getMe(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const { password, ...result } = user;
    const roles = await this.getRoleNames(userId);
    return { ...result, roles };
  }

  private async getRoleNames(userId: string): Promise<string[]> {
    const assignments = await this.userRoleRepo.findByUserId(userId);
    return assignments
      .map((assignment) => assignment.role?.name)
      .filter((name): name is string => !!name);
  }

  private async generateToken(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: this.request.tenantId,
      schemaName: this.request.tenantSchema,
      isAdmin: user.isAdmin === true,
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
        status: user.status,
        isAdmin: user.isAdmin === true,
      },
      tenant: {
        id: this.request.tenantId,
        slug: this.request.tenantSlug,
        schema: this.request.tenantSchema,
      },
    };
  }

  // --- Email verification (non-blocking) ---------------------------------

  /** Mint + email a verification token (link carries the tenant slug). */
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
      this.tenantSlug,
    );
  }

  /** Pre-check a verification token without consuming it. */
  async checkVerificationToken(rawToken: string): Promise<{ email: string }> {
    const { user } = await this.resolveVerification(rawToken);
    return { email: user.email };
  }

  /** Consume a verification token and flag the user verified (non-blocking). */
  async verifyEmail(rawToken: string) {
    const { user, record } = await this.resolveVerification(rawToken);

    user.emailVerifiedAt = new Date();
    await this.userRepo.save(user);

    record.usedAt = new Date();
    await this.authTokenRepo.save(record);

    return { email: user.email, emailVerifiedAt: user.emailVerifiedAt };
  }

  /** Re-issue a verification email if the user exists and isn't verified yet. */
  async resendVerification(email: string): Promise<void> {
    const user = await this.userRepo.findByEmail(email);
    if (user && !user.emailVerifiedAt) {
      await this.issueEmailVerification(user);
    }
  }

  // --- Password reset / change -------------------------------------------

  /** Mint + email a reset token if the user exists (always silent). */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.userRepo.findByEmail(email);
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
      this.tenantSlug,
    );
  }

  /** Pre-check a reset token without consuming it. */
  async checkResetToken(rawToken: string): Promise<{ email: string }> {
    const { user } = await this.resolveReset(rawToken);
    return { email: user.email };
  }

  /** Consume a reset token and set the new password. */
  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const { user, record } = await this.resolveReset(rawToken);

    user.password = await bcrypt.hash(newPassword, 10);
    await this.userRepo.save(user);

    record.usedAt = new Date();
    await this.authTokenRepo.save(record);
  }

  /** Change password for an authenticated user (verifies the current one). */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userRepo.findByIdWithPassword(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await this.userRepo.save(user);
  }

  private async resolveVerification(
    rawToken: string,
  ): Promise<{ user: User; record: AuthToken }> {
    const record = await this.authTokenRepo.findByHash(
      hashToken(rawToken),
      AuthTokenType.EMAIL_VERIFICATION,
    );
    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Invalid or expired verification link');
    }
    const user = await this.userRepo.findById(record.userId);
    if (!user) {
      throw new BadRequestException('Invalid verification link');
    }
    return { user, record };
  }

  private async resolveReset(
    rawToken: string,
  ): Promise<{ user: User; record: AuthToken }> {
    const record = await this.authTokenRepo.findByHash(
      hashToken(rawToken),
      AuthTokenType.PASSWORD_RESET,
    );
    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Invalid or expired reset link');
    }
    const user = await this.userRepo.findById(record.userId);
    if (!user) {
      throw new BadRequestException('Invalid reset link');
    }
    return { user, record };
  }
}
