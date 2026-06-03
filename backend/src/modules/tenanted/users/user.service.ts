import { ConflictException, Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { RoleRepository } from '../rbac/role.repository';
import { UserRoleRepository } from '../rbac/user-role.repository';
import { UserRepository } from './user.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { FilterUserDto } from './dto/filter-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { UserStatus } from './enums/user-status.enum';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly userRepo: UserRepository,
    private readonly roleRepo: RoleRepository,
    private readonly userRoleRepo: UserRoleRepository,
  ) {}

  async findFiltered(filterUserDto: FilterUserDto): Promise<User[]> {
    this.logger.log(`${this.findFiltered.name} Service Called`);

    const { id, name, email, roleId } = filterUserDto;

    if (roleId) {
      return this.userRepo.findByRoleId(roleId, {
        id,
        name,
        email,
      });
    }

    const where: Record<string, any> = {};
    if (id) where.id = id;
    if (name) where.name = name;
    if (email) where.email = email;

    return this.userRepo.findFiltered(where);
  }

  async findById(id: string): Promise<User> {
    return this.userRepo.findByIdOrFail(id);
  }

  async create(dto: CreateUserDto): Promise<User> {
    this.logger.log(`${this.create.name} Service Called`);

    const existing = await this.userRepo.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    // Validate the requested roles up front so we never create a user
    // and then fail half-way through assigning roles.
    const roleIds = [...new Set(dto.roleIds ?? [])];
    for (const roleId of roleIds) {
      await this.roleRepo.findByIdOrFail(roleId);
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.userRepo.saveNew({
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
      status: dto.status ?? UserStatus.ACTIVE,
    });

    for (const roleId of roleIds) {
      await this.userRoleRepo.assign(user.id, roleId);
    }

    return this.findById(user.id);
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    this.logger.log(`${this.update.name} Service Called`);

    const user = await this.findById(id);
    Object.assign(user, dto);
    await this.userRepo.save(user);
    return this.findById(id);
  }

  async remove(id: string): Promise<void> {
    this.logger.log(`${this.remove.name} Service Called`);

    await this.findById(id);
    await this.userRepo.deleteById(id);
  }

  async getProfile(userId: string) {
    const user = await this.findById(userId);
    const { password, ...result } = user;
    return result;
  }

  async grantAdmin(id: string): Promise<User> {
    return this.setAdmin(id, true);
  }

  async revokeAdmin(id: string): Promise<User> {
    return this.setAdmin(id, false);
  }

  private async setAdmin(id: string, value: boolean): Promise<User> {
    const user = await this.findById(id);
    if (user.isAdmin === value) {
      return user;
    }
    user.isAdmin = value;
    await this.userRepo.save(user);
    return this.findById(id);
  }
}
