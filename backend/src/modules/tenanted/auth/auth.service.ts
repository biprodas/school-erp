import {
  Inject,
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { RequestWithTenant } from '~/tenancy/tenant.middleware';
import { RoleRepository } from '../rbac/role.repository';
import { UserRoleRepository } from '../rbac/user-role.repository';
import { ADMIN_ROLE_NAME } from '../rbac/system-roles.seed';
import { UserRepository } from '../users/user.repository';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly roleRepo: RoleRepository,
    private readonly userRoleRepo: UserRoleRepository,
    @Inject(REQUEST) private readonly request: RequestWithTenant,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const { email, password, firstName, lastName } = dto;
    const existing = await this.userRepo.findByEmail(email);
    if (existing) {
      throw new ConflictException('User already exists');
    }

    // The very first user registered in a tenant bootstraps administration:
    // they receive the seeded `admin` role so they can manage everyone else.
    const isFirstUser = (await this.userRepo.count()) === 0;

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await this.userRepo.saveNew({
      email,
      password: hashedPassword,
      firstName,
      lastName,
    });

    if (isFirstUser) {
      const adminRole = await this.roleRepo.findByName(ADMIN_ROLE_NAME);
      if (adminRole) {
        await this.userRoleRepo.assign(user.id, adminRole.id);
      }
    }

    return this.generateToken(user);
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
    };

    const roles = await this.getRoleNames(user.id);

    return {
      access_token: this.jwtService.sign(payload),
      token_type: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        roles,
        status: user.status,
      },
      tenant: {
        id: this.request.tenantId,
        slug: this.request.tenantSlug,
        schema: this.request.tenantSchema,
      },
    };
  }
}
