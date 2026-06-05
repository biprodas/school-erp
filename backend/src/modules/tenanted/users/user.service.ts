import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { RoleRepository } from '../rbac/role.repository';
import { UserRoleRepository } from '../rbac/user-role.repository';
import { UserRepository } from './user.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { FilterUserDto } from './dto/filter-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { UserStatus } from './enums/user-status.enum';

/** A user enriched with a flat list of its assigned roles for API responses. */
export interface SerializedUser {
  id: string;
  email: string;
  name: string;
  status: string;
  isAdmin: boolean;
  platformUserId: string | null;
  roles: { id: string; name: string }[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly userRepo: UserRepository,
    private readonly roleRepo: RoleRepository,
    private readonly userRoleRepo: UserRoleRepository,
  ) {}

  /** Flattens the loaded `userRoles` relation into a tidy `roles` array. */
  private serialize(user: User): SerializedUser {
    const { userRoles, password: _password, ...rest } = user;
    const roles = (userRoles ?? [])
      .map((ur) => ur.role)
      .filter((role): role is NonNullable<typeof role> => !!role)
      .map((role) => ({ id: role.id, name: role.name }));
    return { ...rest, roles };
  }

  async findFiltered(filterUserDto: FilterUserDto): Promise<SerializedUser[]> {
    this.logger.log(`${this.findFiltered.name} Service Called`);

    const { id, name, email, roleId } = filterUserDto;

    const users = roleId
      ? await this.userRepo.findByRoleId(roleId, { id, name, email })
      : await this.userRepo.findFiltered(this.buildWhere({ id, name, email }));

    return users.map((user) => this.serialize(user));
  }

  private buildWhere({
    id,
    name,
    email,
  }: Pick<FilterUserDto, 'id' | 'name' | 'email'>): Record<string, any> {
    const where: Record<string, any> = {};
    if (id) where.id = id;
    if (name) where.name = name;
    if (email) where.email = email;
    return where;
  }

  async findById(id: string): Promise<SerializedUser> {
    return this.serialize(await this.getEntityOrFail(id));
  }

  /** Loads the raw entity (with roles) for internal mutation/use. */
  private async getEntityOrFail(id: string): Promise<User> {
    const user = await this.userRepo.findByIdWithRoles(id);
    if (!user) {
      throw new NotFoundException(`User with id "${id}" not found`);
    }
    return user;
  }

  async create(dto: CreateUserDto): Promise<SerializedUser> {
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

  async update(id: string, dto: UpdateUserDto): Promise<SerializedUser> {
    this.logger.log(`${this.update.name} Service Called`);

    const user = await this.getEntityOrFail(id);
    Object.assign(user, dto);
    await this.userRepo.save(user);
    return this.findById(id);
  }

  async remove(id: string): Promise<void> {
    this.logger.log(`${this.remove.name} Service Called`);

    await this.getEntityOrFail(id);
    await this.userRepo.deleteById(id);
  }

  async getProfile(userId: string): Promise<SerializedUser> {
    return this.findById(userId);
  }

  async grantAdmin(id: string): Promise<SerializedUser> {
    return this.setAdmin(id, true);
  }

  async revokeAdmin(id: string): Promise<SerializedUser> {
    return this.setAdmin(id, false);
  }

  private async setAdmin(id: string, value: boolean): Promise<SerializedUser> {
    const user = await this.getEntityOrFail(id);
    if (user.isAdmin !== value) {
      user.isAdmin = value;
      await this.userRepo.save(user);
    }
    return this.findById(id);
  }
}
