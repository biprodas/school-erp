import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { normalizeEmail } from '~/common/identity/identifier';
import { hashPassword } from '~/common/identity/password';
import { Not, Repository } from 'typeorm';
import { RequestContextDto } from '~/common/dto/request-context.dto';
import {
  PLATFORM_PERMISSIONS,
  platformCan,
} from '~/common/auth/platform-permissions';
import { CreateUserDto } from '../dto/create-user.dto';
import { FilterUserDto } from '../dto/filter-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { User } from '../entities/user.entity';
import { PlatformRole } from '../enums/platform-role.enum';
import { UserStatus } from '../enums/user-status.enum';
import { SessionService } from '~/modules/auth/services/session.service';

@Injectable()
export class UserService {
  private logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly sessions: SessionService,
  ) {}

  async findAll(
    ctx: RequestContextDto,
    filterUserDto: FilterUserDto,
  ): Promise<User[]> {
    this.logger.log(`${this.findAll.name} Service Called`);

    const { id, name, email, platformRole } = filterUserDto;
    // Unset filters must be left out: TypeORM 1.x throws on undefined.
    return this.userRepo.find({
      where: {
        ...(id ? { id } : {}),
        ...(name ? { name } : {}),
        ...(email ? { email: normalizeEmail(email) } : {}),
        ...(platformRole ? { platformRole } : {}),
      },
    });
  }

  async findById(_ctx: RequestContextDto, id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async createPlatformUser(
    ctx: RequestContextDto,
    dto: CreateUserDto,
  ): Promise<User> {
    this.logger.log(`${this.createPlatformUser.name} Service Called`);

    const existing = await this.userRepo.findOne({
      where: { email: normalizeEmail(dto.email) },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await hashPassword(dto.password);
    const user = this.userRepo.create({
      email: normalizeEmail(dto.email),
      password: hashedPassword,
      // Chosen by an admin: temporary until the user replaces it.
      mustChangePassword: true,
      name: dto.name,
      status: dto.status ?? UserStatus.ACTIVE,
      platformRole: dto.platformRole ?? PlatformRole.USER,
    });
    await this.userRepo.save(user);
    return this.findById(ctx, user.id);
  }

  async update(
    ctx: RequestContextDto,
    targetId: string,
    dto: UpdateUserDto,
  ): Promise<User> {
    this.logger.log(`${this.update.name} Service Called`);

    const isSelf = ctx.user?.id === targetId;
    const canManage = platformCan(
      ctx.user?.platformRole,
      PLATFORM_PERMISSIONS.PLATFORM_USERS_MANAGE,
    );

    if (!isSelf && !canManage) {
      throw new ForbiddenException('You can only update your own profile');
    }

    const changesAccess =
      dto.status !== undefined || dto.platformRole !== undefined;
    if (changesAccess && !canManage) {
      throw new ForbiddenException(
        'Only a super admin can change status or platform role',
      );
    }
    // Nobody locks themselves out (or in) by editing their own account.
    if (changesAccess && isSelf) {
      throw new ForbiddenException({
        message: 'You cannot change your own status or platform role',
        code: 'CANNOT_CHANGE_OWN_ACCESS',
      });
    }

    const user = await this.findById(ctx, targetId);
    const before = { status: user.status, platformRole: user.platformRole };
    const after = {
      status: dto.status ?? user.status,
      platformRole: dto.platformRole ?? user.platformRole,
    };
    if (isActiveSuperAdmin(before) && !isActiveSuperAdmin(after)) {
      await this.assertAnotherSuperAdmin(targetId);
    }
    Object.assign(user, dto);
    const saved = await this.userRepo.save(user);
    // A new role or a blocked account ends every sign-in: the role is in
    // the platform access token.
    const blocked =
      dto.status !== undefined &&
      dto.status !== UserStatus.ACTIVE &&
      dto.status !== UserStatus.PENDING;
    if (blocked || saved.platformRole !== before.platformRole) {
      await this.sessions.revokeAllForUser(saved.id);
    }
    return saved;
  }

  async remove(ctx: RequestContextDto, targetId: string): Promise<void> {
    this.logger.log(`${this.remove.name} Service Called`);

    if (ctx.user?.id === targetId) {
      throw new ForbiddenException({
        message: 'You cannot remove your own account',
        code: 'CANNOT_CHANGE_OWN_ACCESS',
      });
    }
    const user = await this.findById(ctx, targetId);
    if (isActiveSuperAdmin(user)) {
      await this.assertAnotherSuperAdmin(targetId);
    }
    await this.sessions.revokeAllForUser(targetId);
    await this.userRepo.delete(targetId);
  }

  /** The platform always keeps one active super admin to manage staff. */
  private async assertAnotherSuperAdmin(exceptId: string): Promise<void> {
    const others = await this.userRepo.count({
      where: {
        platformRole: PlatformRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        id: Not(exceptId),
      },
    });
    if (others === 0) {
      throw new ConflictException({
        message: 'The platform needs at least one active super admin',
        code: 'LAST_SUPER_ADMIN',
      });
    }
  }
}

const isActiveSuperAdmin = (user: {
  status: UserStatus;
  platformRole: PlatformRole;
}) =>
  user.platformRole === PlatformRole.SUPER_ADMIN &&
  user.status === UserStatus.ACTIVE;
