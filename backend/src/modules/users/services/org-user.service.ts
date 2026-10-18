import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
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
   * Adds a user to this school. A brand-new email creates the global
   * account with the given password; an existing account is linked as-is
   * (its password is never changed from here).
   */
  create(dto: CreateOrgUserDto): Promise<SerializedUser> {
    return this.ds.runInTransaction(async () => {
      this.logger.log(`${this.create.name} Service Called`);

      // Validate the requested roles up front so we never create a member
      // and then fail half-way through assigning roles.
      const roleIds = [...new Set(dto.roleIds ?? [])];
      for (const roleId of roleIds) {
        await this.roleService.findById(roleId);
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
        await this.roleService.assignRole(account.id, roleId);
      }

      return this.findById(account.id);
    });
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
