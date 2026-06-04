import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { RequestWithTenant } from '~/tenancy/tenant.middleware';
import { UserRoleRepository } from '../rbac/user-role.repository';
import { UserRepository } from '../users/user.repository';
import { User } from '../users/entities/user.entity';
import { UserStatus } from '../users/enums/user-status.enum';
import { LoginDto } from './dto/login.dto';
import { ActivateDto } from './dto/activate.dto';
import { ActivationToken } from './entities/activation-token.entity';
import { ActivationTokenRepository } from './activation-token.repository';
import { hashActivationToken } from './owner-provisioning.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly userRoleRepo: UserRoleRepository,
    private readonly activationTokenRepo: ActivationTokenRepository,
    @Inject(REQUEST) private readonly request: RequestWithTenant,
    private readonly jwtService: JwtService,
  ) {}

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
}
