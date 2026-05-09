import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from 'src/modules/platform/users/entities/user.entity';
import { UserStatus } from 'src/modules/platform/users/enums/user-status.enum';
import { PlatformRegisterDto } from './dto/platform-register.dto';
import { PlatformLoginDto } from './dto/platform-login.dto';

@Injectable()
export class PlatformAuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

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
      firstName: dto.firstName,
      lastName: dto.lastName,
    });
    await this.userRepository.save(user);

    return this.buildTokenResponse(user);
  }

  async login(dto: PlatformLoginDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
      select: ['id', 'email', 'password', 'firstName', 'lastName', 'role', 'status'],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(`Account is ${user.status}`);
    }

    const isValid = await bcrypt.compare(dto.password, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
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

  private buildTokenResponse(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
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
    };
  }
}
