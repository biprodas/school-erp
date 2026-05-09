import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { RequestContextDto } from '~/common/dto/request-context.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { FilterUserDto } from './dto/filter-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { PlatformRole } from './enums/platform-role.enum';
import { UserStatus } from './enums/user-status.enum';

@Injectable()
export class UserService {
  private logger = new Logger(UserService.name)


  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findAll(ctx: RequestContextDto, filterUserDto: FilterUserDto): Promise<User[]> {
    this.logger.log(`${this.findAll.name} Service Called`)

    const { id, firstName, lastName, email, role } = filterUserDto
    const reqQuery: any = { id, firstName, lastName, email, role }

    return this.userRepo.find({ where: reqQuery })
  }

  async findById(_ctx: RequestContextDto, id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async createPlatformUser(ctx: RequestContextDto, dto: CreateUserDto): Promise<User> {
    this.logger.log(`${this.createPlatformUser.name} Service Called`)

    const existing = await this.userRepo.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      email: dto.email,
      password: hashedPassword,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: dto.role ?? PlatformRole.USER,
      status: dto.status ?? UserStatus.ACTIVE,
    });
    await this.userRepo.save(user);
    return this.findById(ctx, user.id);
  }

  async update(ctx: RequestContextDto, targetId: string, dto: UpdateUserDto): Promise<User> {
    this.logger.log(`${this.update.name} Service Called`)

    const isSelf = ctx.user?.id === targetId;
    const isSuperAdmin = ctx.user?.role === PlatformRole.SUPER_ADMIN;

    if (!isSelf && !isSuperAdmin) {
      throw new ForbiddenException('You can only update your own profile');
    }

    // Only super admin can change role or status
    if (!isSuperAdmin) {
      delete dto.role;
      delete dto.status;
    }

    const user = await this.findById(ctx, targetId);
    Object.assign(user, dto);
    return this.userRepo.save(user);
  }

  async remove(ctx: RequestContextDto, targetId: string): Promise<void> {
    this.logger.log(`${this.remove.name} Service Called`)

    await this.findById(ctx, targetId);
    await this.userRepo.delete(targetId);
  }
}

