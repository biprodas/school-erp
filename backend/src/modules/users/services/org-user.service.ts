import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { normalizeEmail, normalizePhone } from '~/common/identity/identifier';
import type { User } from '../entities/user.entity';
import { Membership } from '~/modules/memberships/entities/membership.entity';
import { MembershipStatus } from '~/modules/memberships/enums/membership-status.enum';
import { UserStatus } from '../enums/user-status.enum';
import { RoleService } from '~/modules/rbac/services/role.service';
import { AccountRepository } from '../repositories/account.repository';
import { MemberRepository } from '../repositories/member.repository';
import { CreateOrgUserDto } from '../dto/create-org-user.dto';
import { FilterOrgUserDto } from '../dto/filter-org-user.dto';
import { UpdateOrgUserDto } from '../dto/update-org-user.dto';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';

/**
 * A member of the current organization: the global user account merged with
 * its per-org membership (status, admin flag) and assigned roles. `id` is the
 * global user id, so it can be used with the user-role endpoints.
 */
export interface SerializedUser {
  id: string;
  membershipId: string;
  email: string | null;
  phone: string | null;
  name: string;
  status: MembershipStatus;
  isAdmin: boolean;
  emailVerifiedAt: Date | null;
  roles: { id: string; name: string }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AddMemberInput {
  name: string;
  email?: string;
  phone?: string;
  /** Temporary password for a new account (must be changed at sign-in). */
  password?: string;
  status: MembershipStatus;
  roleIds?: string[];
}

export interface AddMemberResult {
  userId: string;
  account: User;
  /** False when an existing global account was linked. */
  createdAccount: boolean;
}

/**
 * Manages the users of the current school. Users are global accounts (one
 * login across schools); "adding" a user creates a membership in this org and
 * "removing" one deletes only that membership and its role assignments.
 */
@Injectable()
export class OrgUserService {
  private readonly logger = new Logger(OrgUserService.name);

  constructor(
    private readonly accountRepo: AccountRepository,
    private readonly memberRepo: MemberRepository,
    private readonly roleService: RoleService,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  private async serialize(members: Membership[]): Promise<SerializedUser[]> {
    const assignments = await this.roleService.findAssignments(
      members.map((m) => m.userId),
    );
    return members.map((m) => ({
      id: m.userId,
      membershipId: m.id,
      email: m.user.email,
      phone: m.user.phone,
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

  async findFiltered(
    filterUserDto: FilterOrgUserDto,
  ): Promise<SerializedUser[]> {
    this.logger.log(`${this.findFiltered.name} Service Called`);

    const { id, name, email, roleId } = filterUserDto;

    let userIds: string[] | undefined;
    if (roleId) {
      userIds = await this.roleService.findUserIdsWithRole(roleId);
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

  /** Gives a member of this org a role (users are global accounts). */
  async assignRole(userId: string, roleId: string): Promise<void> {
    await this.getMemberOrFail(userId);
    await this.roleService.assignRole(userId, roleId);
  }

  /**
   * Adds a user to this school with an admin-chosen, temporary password
   * (the user must change it at first sign-in). An existing account (same
   * email or phone) is linked as-is: its password is never changed here.
   */
  create(dto: CreateOrgUserDto): Promise<SerializedUser> {
    return this.ds.runInTransaction(async () => {
      this.logger.log(`${this.create.name} Service Called`);
      const { userId } = await this.addMember({
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        password: dto.password,
        status: dto.status ?? MembershipStatus.ACTIVE,
        roleIds: dto.roleIds,
      });
      return this.findById(userId);
    });
  }

  /**
   * Finds the global account by email or phone (creating it if neither
   * matches) and adds a membership in this school with the given roles.
   * A new account gets `password` as a temporary one, or an unusable random
   * one when it will be set through an activation link. Call inside
   * `ds.runInTransaction`.
   */
  async addMember(input: AddMemberInput): Promise<AddMemberResult> {
    const email = input.email ? normalizeEmail(input.email) : undefined;
    const phone = input.phone ? normalizePhone(input.phone) : undefined;
    if (!email && !phone) {
      throw new BadRequestException({
        message: 'An email address or a phone number is required',
        code: 'IDENTIFIER_REQUIRED',
      });
    }
    if (phone === null) {
      throw new BadRequestException({
        message: 'Invalid phone number',
        code: 'INVALID_PHONE',
      });
    }

    // Validate the requested roles up front so we never create a member
    // and then fail half-way through assigning roles.
    const roleIds = [...new Set(input.roleIds ?? [])];
    for (const roleId of roleIds) {
      await this.roleService.findById(roleId);
    }

    const byEmail = email ? await this.accountRepo.findByEmail(email) : null;
    const byPhone = phone ? await this.accountRepo.findByPhone(phone) : null;
    if (byEmail && byPhone && byEmail.id !== byPhone.id) {
      throw new ConflictException({
        message: 'The email and the phone number belong to different accounts',
        code: 'IDENTIFIER_CONFLICT',
      });
    }
    let account = byEmail ?? byPhone;
    const createdAccount = !account;
    if (account) {
      if (await this.memberRepo.findByUserId(account.id)) {
        throw new ConflictException({
          message: 'User is already a member of this organization',
          code: 'ALREADY_MEMBER',
        });
      }
    } else {
      account = await this.accountRepo.saveNew({
        name: input.name,
        email: email ?? null,
        phone: phone ?? null,
        password: await bcrypt.hash(
          input.password ?? randomBytes(32).toString('base64url'),
          10,
        ),
        mustChangePassword: input.password !== undefined,
        status: UserStatus.ACTIVE,
      });
    }

    await this.memberRepo.saveNew({ userId: account.id, status: input.status });
    for (const roleId of roleIds) {
      await this.roleService.assignRole(account.id, roleId);
    }
    return { userId: account.id, account, createdAccount };
  }

  /** Marks this school's membership of the user ACTIVE (existing accounts). */
  async activateMembership(userId: string): Promise<void> {
    const member = await this.getMemberOrFail(userId);
    if (member.status !== MembershipStatus.ACTIVE) {
      member.status = MembershipStatus.ACTIVE;
      await this.memberRepo.save(member);
    }
  }

  async update(id: string, dto: UpdateOrgUserDto): Promise<SerializedUser> {
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
  remove(id: string): Promise<void> {
    return this.ds.runInTransaction(async () => {
      this.logger.log(`${this.remove.name} Service Called`);

      const member = await this.getMemberOrFail(id);
      await this.roleService.unassignAll(id);
      await this.memberRepo.deleteById(member.id);
    });
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
