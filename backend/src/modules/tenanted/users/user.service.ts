import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Membership } from '~/platform/memberships/entities/membership.entity';
import { MembershipStatus } from '~/platform/memberships/enums/membership-status.enum';
import { UserStatus } from '~/platform/users/enums/user-status.enum';
import { RoleRepository } from '../rbac/role.repository';
import { UserRoleRepository } from '../rbac/user-role.repository';
import { AccountRepository } from './account.repository';
import { MemberRepository } from './member.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { FilterUserDto } from './dto/filter-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

/**
 * A member of the current organization: the global user account merged with
 * its per-org membership (status, admin flag) and assigned roles. `id` is the
 * global user id, so it can be used with the user-role endpoints.
 */
export interface SerializedUser {
  id: string;
  membershipId: string;
  email: string;
  name: string;
  status: MembershipStatus;
  isAdmin: boolean;
  emailVerifiedAt: Date | null;
  roles: { id: string; name: string }[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Manages the users of the current school. Users are global accounts (one
 * login across schools); "adding" a user creates a membership in this org and
 * "removing" one deletes only that membership and its role assignments.
 */
@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly accountRepo: AccountRepository,
    private readonly memberRepo: MemberRepository,
    private readonly roleRepo: RoleRepository,
    private readonly userRoleRepo: UserRoleRepository,
  ) {}

  private async serialize(members: Membership[]): Promise<SerializedUser[]> {
    const assignments = await this.userRoleRepo.findByUserIds(
      members.map((m) => m.userId),
    );
    return members.map((m) => ({
      id: m.userId,
      membershipId: m.id,
      email: m.user.email,
      name: m.user.name,
      status: m.status,
      isAdmin: m.isAdmin,
      emailVerifiedAt: m.user.emailVerifiedAt,
      roles: assignments
        .filter((a) => a.userId === m.userId && a.role)
        .map((a) => ({ id: a.role.id, name: a.role.name })),
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));
  }

  async findFiltered(filterUserDto: FilterUserDto): Promise<SerializedUser[]> {
    this.logger.log(`${this.findFiltered.name} Service Called`);

    const { id, name, email, roleId } = filterUserDto;

    let userIds: string[] | undefined;
    if (roleId) {
      const assignments = await this.userRoleRepo.findByRoleId(roleId);
      userIds = assignments.map((a) => a.userId);
      if (!userIds.length) return [];
    }

    const members = await this.memberRepo.findFiltered({
      userId: id,
      userIds,
      name,
      email,
    });
    return this.serialize(members);
  }

  async findById(id: string): Promise<SerializedUser> {
    const [serialized] = await this.serialize([await this.getMemberOrFail(id)]);
    return serialized;
  }

  /** Loads the membership (with its account) of a user in this org. */
  private async getMemberOrFail(userId: string): Promise<Membership> {
    const member = await this.memberRepo.findByUserId(userId);
    if (!member) {
      throw new NotFoundException(`User with id "${userId}" not found`);
    }
    return member;
  }

  /**
   * Adds a user to this school. A brand-new email creates the global
   * account with the given password; an existing account is linked as-is
   * (its password is never changed from here).
   */
  async create(dto: CreateUserDto): Promise<SerializedUser> {
    this.logger.log(`${this.create.name} Service Called`);

    // Validate the requested roles up front so we never create a member
    // and then fail half-way through assigning roles.
    const roleIds = [...new Set(dto.roleIds ?? [])];
    for (const roleId of roleIds) {
      await this.roleRepo.findByIdOrFail(roleId);
    }

    let account = await this.accountRepo.findByEmail(dto.email);
    if (account) {
      const existing = await this.memberRepo.findByUserId(account.id);
      if (existing) {
        throw new ConflictException(
          'User is already a member of this organization',
        );
      }
    } else {
      account = await this.accountRepo.saveNew({
        name: dto.name,
        email: dto.email,
        password: await bcrypt.hash(dto.password, 10),
        status: UserStatus.ACTIVE,
      });
    }

    await this.memberRepo.saveNew({
      userId: account.id,
      status: dto.status ?? MembershipStatus.ACTIVE,
    });

    for (const roleId of roleIds) {
      await this.userRoleRepo.assign(account.id, roleId);
    }

    return this.findById(account.id);
  }

  async update(id: string, dto: UpdateUserDto): Promise<SerializedUser> {
    this.logger.log(`${this.update.name} Service Called`);

    const member = await this.getMemberOrFail(id);
    if (dto.status !== undefined && dto.status !== member.status) {
      member.status = dto.status;
      await this.memberRepo.save(member);
    }
    if (dto.name !== undefined && dto.name !== member.user.name) {
      member.user.name = dto.name;
      await this.accountRepo.save(member.user);
    }
    return this.findById(id);
  }

  /** Removes the user from this org (membership + role assignments only). */
  async remove(id: string): Promise<void> {
    this.logger.log(`${this.remove.name} Service Called`);

    const member = await this.getMemberOrFail(id);
    await this.userRoleRepo.unassignAll(id);
    await this.memberRepo.deleteById(member.id);
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
    const member = await this.getMemberOrFail(id);
    if (member.isAdmin !== value) {
      member.isAdmin = value;
      await this.memberRepo.save(member);
    }
    return this.findById(id);
  }
}
