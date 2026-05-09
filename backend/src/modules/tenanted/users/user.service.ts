import {
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRepository } from './user.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { FilterUserDto } from './dto/filter-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { UserRole } from './enums/user-role.enum';
import { UserStatus } from './enums/user-status.enum';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly userRepo: UserRepository) {}

  async findFiltered(filterUserDto: FilterUserDto): Promise<User[]> {
    this.logger.log(`${this.findFiltered.name} Service Called`);

    const { id, firstName, lastName, email, role } = filterUserDto;
    const where: any = {};
    if (id) where.id = id;
    if (firstName) where.firstName = firstName;
    if (lastName) where.lastName = lastName;
    if (email) where.email = email;
    if (role) where.role = role;

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

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.userRepo.saveNew({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      password: hashedPassword,
      role: dto.role ?? UserRole.USER,
      status: dto.status ?? UserStatus.ACTIVE,
    });

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
}
