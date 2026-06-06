import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import type { RequestWithTenant } from '~/tenancy/tenant.middleware';
import { Tenant } from '~/platform/tenants/entities/tenant.entity';
import { TenantBootstrapStatus } from '~/platform/tenants/enums/tenant-bootstrap-status.enum';
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
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
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

    // Advance onboarding: a self-service owner still has a completion step,
    // whereas an admin-invited owner is done the moment they activate.
    const bootstrapStatus = await this.advanceBootstrapAfterActivation();

    return this.generateToken(user, bootstrapStatus);
  }

  /**
   * Moves the tenant's onboarding forward after the owner sets their password:
   * `school_created → owner_activated` (self-service, completion still pending)
   * and `admin_invited → completed` (owner skips straight to the dashboard).
   * Returns the resulting status (or the unchanged one for other states).
   */
  private async advanceBootstrapAfterActivation(): Promise<TenantBootstrapStatus | null> {
    const tenant = await this.loadTenant();
    if (!tenant) return null;

    let next: TenantBootstrapStatus | null = null;
    if (tenant.bootstrapStatus === TenantBootstrapStatus.SCHOOL_CREATED) {
      next = TenantBootstrapStatus.OWNER_ACTIVATED;
    } else if (tenant.bootstrapStatus === TenantBootstrapStatus.ADMIN_INVITED) {
      next = TenantBootstrapStatus.COMPLETED;
    }

    if (next && next !== tenant.bootstrapStatus) {
      tenant.bootstrapStatus = next;
      await this.tenantRepo.save(tenant);
    }
    return tenant.bootstrapStatus;
  }

  /** Loads the current request's tenant row from the platform (public) schema. */
  private async loadTenant(): Promise<Tenant | null> {
    const tenantId = this.request.tenantId;
    if (!tenantId) return null;
    return this.tenantRepo.findOne({ where: { id: tenantId } });
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

  private async generateToken(
    user: User,
    bootstrapStatus?: TenantBootstrapStatus | null,
  ) {
    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: this.request.tenantId,
      schemaName: this.request.tenantSchema,
      isAdmin: user.isAdmin === true,
    };

    const roles = await this.getRoleNames(user.id);

    // For logins (and any caller that didn't already resolve it) read the
    // current bootstrap status so the session/dashboard can gate on it.
    const status =
      bootstrapStatus !== undefined
        ? bootstrapStatus
        : ((await this.loadTenant())?.bootstrapStatus ?? null);

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
        bootstrapStatus: status,
      },
    };
  }
}
