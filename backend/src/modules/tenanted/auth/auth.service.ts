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
import { UserRepository } from '../users/user.repository';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepo: UserRepository,
    @Inject(REQUEST) private readonly request: RequestWithTenant,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const { email, password, firstName, lastName } = dto;
    const existing = await this.userRepo.findByEmail(email);
    if (existing) {
      throw new ConflictException('User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await this.userRepo.saveNew({
      email,
      password: hashedPassword,
      firstName,
      lastName,
    });

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
    return result;
  }

  private generateToken(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: this.request.tenantId,
      schemaName: this.request.tenantSchema,
    };

    return {
      access_token: this.jwtService.sign(payload),
      token_type: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        role: user.role,
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
