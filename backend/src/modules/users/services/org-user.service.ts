import { EntitlementService } from '~/modules/plans/services/entitlement.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { normalizeEmail, normalizePhone } from '~/common/identity/identifier';
import { hashPassword, unusablePasswordHash } from '~/common/identity/password';
import type {
  GUARDIAN_ROLE_NAME,
  STUDENT_ROLE_NAME,
} from '~/modules/rbac/system-roles.seed';
import type { User } from '../entities/user.entity';
import { Membership } from '~/modules/memberships/entities/membership.entity';
import { MembershipStatus } from '~/modules/memberships/enums/membership-status.enum';
import { UserStatus } from '../enums/user-status.enum';
import { RoleService } from '~/modules/rbac/services/role.service';
import type { Role } from '~/modules/rbac/entities/role.entity';
import { AccountRepository } from '../repositories/account.repository';
import { MemberRepository } from '../repositories/member.repository';
import { CreateOrgUserDto } from '../dto/create-org-user.dto';
import { FilterOrgUserDto } from '../dto/filter-org-user.dto';
import { UpdateOrgUserDto } from '../dto/update-org-user.dto';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { AuditService } from '~/modules/audit/services/audit.service';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';
import { RequestContext } from '~/shared/request-context/request-context.service';
import { SessionService } from '~/modules/auth/services/session.service';

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
  /**
   * The guardian or student system role, given without the escalation
   * check (portal roles reach no staff endpoint).
   */
  portalRole?: typeof GUARDIAN_ROLE_NAME | typeof STUDENT_ROLE_NAME;
}

export interface AddMemberResult {
  userId: string;
  account: User;
  /**
   * True when this school set up the sign-in: a new account, or one that
   * was registered but never verified (see `addMember`). False when an
   * existing account was linked and keeps its password.
   */
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
    private readonly audit: AuditService,
    private readonly context: RequestContext,
    private readonly sessions: SessionService,
    private readonly entitlements: EntitlementService,
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

  /** Members of this school, any status. */
  countMembers(): Promise<number> {
    return this.memberRepo.count();
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

    await this.entitlements.assertLimit(this.ds.orgId, 'users');

    // Validate the requested roles up front so we never create a member
    // and then fail half-way through assigning roles.
    const roleIds = [...new Set(input.roleIds ?? [])];
    for (const roleId of roleIds) {
      await this.roleService.findAssignable(roleId);
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
    // A new account, or one that registered on the platform but never
    // verified: nobody has proved they own that email, so its password
    // (chosen by whoever registered it) must not carry over into the school.
    const createdAccount = !account || account.status === UserStatus.PENDING;
    // No password given: an unusable one, and `password_set = false` so the
    // activation link lets the owner choose theirs.
    const newPassword = () =>
      input.password !== undefined
        ? hashPassword(input.password)
        : unusablePasswordHash();
    const passwordSet = input.password !== undefined;
    if (account) {
      if (await this.memberRepo.findByUserId(account.id)) {
        throw new ConflictException({
          message: 'User is already a member of this organization',
          code: 'ALREADY_MEMBER',
        });
      }
      if (createdAccount) {
        account.password = await newPassword();
        account.mustChangePassword = input.password !== undefined;
        account.passwordSet = passwordSet;
        // A temporary password handed over by the school vouches for the
        // person; otherwise the account stays pending until the activation
        // link is used.
        if (input.password !== undefined) account.status = UserStatus.ACTIVE;
        await this.accountRepo.save(account);
      }
    } else {
      account = await this.accountRepo.saveNew({
        name: input.name,
        email: email ?? null,
        phone: phone ?? null,
        password: await newPassword(),
        mustChangePassword: input.password !== undefined,
        passwordSet,
        status: UserStatus.ACTIVE,
      });
    }

    await this.memberRepo.saveNew({ userId: account.id, status: input.status });
    await this.audit.record({
      action: AUDIT_ACTIONS.MEMBER_ADDED,
      entityType: 'user',
      entityId: account.id,
      after: { status: input.status, createdAccount },
    });
    for (const roleId of roleIds) {
      await this.roleService.assignRole(account.id, roleId);
    }
    if (input.portalRole) {
      await this.roleService.assignPortalRole(account.id, input.portalRole);
    }
    return { userId: account.id, account, createdAccount };
  }

  /**
   * More roles for an existing member (e.g. a teacher who is also a
   * guardian here). Staff roles go through the escalation check.
   */
  async addRoles(
    userId: string,
    roleIds: string[] = [],
    portalRole?: AddMemberInput['portalRole'],
  ): Promise<void> {
    await this.getMemberOrFail(userId);
    for (const roleId of new Set(roleIds)) {
      await this.roleService.assignRole(userId, roleId);
    }
    if (portalRole) await this.roleService.assignPortalRole(userId, portalRole);
  }

  /** Marks this school's membership of the user ACTIVE (existing accounts). */
  async activateMembership(userId: string): Promise<void> {
    const member = await this.getMemberOrFail(userId);
    if (member.status !== MembershipStatus.ACTIVE) {
      const before = { status: member.status };
      member.status = MembershipStatus.ACTIVE;
      await this.memberRepo.save(member);
      await this.audit.record({
        action: AUDIT_ACTIONS.MEMBER_UPDATED,
        entityType: 'user',
        entityId: userId,
        before,
        after: { status: member.status },
      });
    }
  }

  async update(id: string, dto: UpdateOrgUserDto): Promise<SerializedUser> {
    let endSessions = false;
    const updated = await this.ds.runInTransaction(async () => {
      const member = await this.getMemberOrFail(id);
      await this.assertCanManageMember(member);
      const before = { status: member.status, name: member.user.name };
      if (dto.status !== undefined && dto.status !== member.status) {
        member.status = dto.status;
        await this.memberRepo.save(member);
        endSessions = member.status !== MembershipStatus.ACTIVE;
      }
      if (dto.name !== undefined && dto.name !== member.user.name) {
        member.user.name = dto.name;
        await this.accountRepo.save(member.user);
      }
      const after = { status: member.status, name: member.user.name };
      if (before.status !== after.status || before.name !== after.name) {
        await this.audit.record({
          action: AUDIT_ACTIONS.MEMBER_UPDATED,
          entityType: 'user',
          entityId: id,
          before,
          after,
        });
      }
      return this.findById(id);
    });
    if (endSessions) await this.endSessions(id);
    return updated;
  }

  /** Removes the user from this org (membership + role assignments only). */
  async remove(id: string): Promise<void> {
    await this.ds.runInTransaction(async () => {
      this.logger.log(`${this.remove.name} Service Called`);

      const member = await this.getMemberOrFail(id);
      const roles = await this.roleService.getUserRoles(id);
      await this.assertCanManageMember(member, roles);
      await this.roleService.unassignAll(id);
      await this.memberRepo.deleteById(member.id);
      await this.audit.record({
        action: AUDIT_ACTIONS.MEMBER_REMOVED,
        entityType: 'user',
        entityId: id,
        before: {
          status: member.status,
          isAdmin: member.isAdmin,
          roles: roles.map((r) => ({ id: r.id, name: r.name })),
        },
      });
    });
    await this.endSessions(id);
  }

  /**
   * Signs the user out of this school after their access shrank. Their
   * access token carries `isAdmin`, so it must stop working rather than
   * live on until it expires. Runs after commit (sessions are identity
   * data on the root connection).
   */
  private endSessions(userId: string): Promise<void> {
    return this.sessions.revokeAllForUserInOrg(userId, this.ds.orgId);
  }

  /**
   * Only school admins change or remove a school admin, and nobody else
   * changes someone whose roles reach further than their own.
   */
  private async assertCanManageMember(
    member: Membership,
    roles?: Role[],
  ): Promise<void> {
    if (member.isAdmin && !this.context.current().isAdmin) {
      throw new ForbiddenException({
        message: 'Only a school admin can change a school admin',
        code: 'ADMIN_ONLY',
      });
    }
    await this.roleService.assertCanManageRoles(
      roles ?? (await this.roleService.getUserRoles(member.userId)),
    );
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
    if (value) await this.entitlements.assertLimit(this.ds.orgId, 'admins');
    let revoked = false;
    const updated = await this.ds.runInTransaction(async () => {
      const member = await this.getMemberOrFail(id);
      if (member.isAdmin !== value) {
        revoked = !value;
        member.isAdmin = value;
        await this.memberRepo.save(member);
        await this.audit.record({
          action: value
            ? AUDIT_ACTIONS.MEMBER_ADMIN_GRANTED
            : AUDIT_ACTIONS.MEMBER_ADMIN_REVOKED,
          entityType: 'user',
          entityId: id,
          before: { isAdmin: !value },
          after: { isAdmin: value },
        });
      }
      return this.findById(id);
    });
    if (revoked) await this.endSessions(id);
    return updated;
  }
}
