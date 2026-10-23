import { isDeepStrictEqual } from 'node:util';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '../entities/role.entity';
import { UserRole } from '../entities/user-role.entity';
import { RoleRepository } from '../repositories/role.repository';
import { UserRoleRepository } from '../repositories/user-role.repository';
import { PERMISSION_SET } from '../permissions.catalog';
import {
  ADMIN_ROLE_NAME,
  GUARDIAN_ROLE_NAME,
  STUDENT_ROLE_NAME,
} from '../system-roles.seed';
import { RoleScope } from '../enums/role-scope.enum';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { CloneRoleDto } from '../dto/clone-role.dto';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { AuditService } from '~/modules/audit/services/audit.service';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';
import { RequestContext } from '~/shared/request-context/request-context.service';
import { PermissionResolverService } from './permission-resolver.service';

/** System roles whose holders use the portal; they hold only `portal:*` keys. */
const PORTAL_ROLE_NAMES = new Set([GUARDIAN_ROLE_NAME, STUDENT_ROLE_NAME]);

const isPortalKey = (key: string): boolean => key.startsWith('portal:');

/** What the audit log keeps of a role. */
function roleSnapshot(role: Role) {
  return {
    name: role.name,
    description: role.description,
    scope: role.scope,
    permissions: [...role.permissions].sort(),
    isSystem: role.isSystem,
  };
}

@Injectable()
export class RoleService {
  private readonly logger = new Logger(RoleService.name);

  constructor(
    private readonly roleRepo: RoleRepository,
    private readonly userRoleRepo: UserRoleRepository,
    private readonly audit: AuditService,
    private readonly resolver: PermissionResolverService,
    private readonly context: RequestContext,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  findAll(): Promise<Role[]> {
    return this.roleRepo.findAll({ order: { name: 'ASC' } });
  }

  findById(id: string): Promise<Role> {
    return this.roleRepo.findByIdOrFail(id);
  }

  /** A seeded system role (e.g. `student`) by name; 404 if it is missing. */
  async findSystemRole(name: string): Promise<Role> {
    const role = await this.roleRepo.findByName(name);
    if (!role) {
      throw new NotFoundException(
        `System role "${name}" is not seeded for this tenant`,
      );
    }
    return role;
  }

  /**
   * A role the current user may give to (or take from) someone: one whose
   * permissions they hold themselves. 404 if it doesn't exist.
   */
  async findAssignable(id: string): Promise<Role> {
    const role = await this.roleRepo.findByIdOrFail(id);
    await this.assertCanManage(role);
    return role;
  }

  create(dto: CreateRoleDto): Promise<Role> {
    return this.ds.runInTransaction(async () => {
      await this.assertNameFree(dto.name);
      const permissions = this.validatePermissions(dto.permissions ?? []);
      const scope = dto.scope ?? RoleScope.SCHOOL;
      this.assertRoleShape(dto.name, false, permissions);
      await this.assertCanGrant(permissions, scope);
      const role = await this.roleRepo.saveNew({
        name: dto.name,
        description: dto.description ?? null,
        permissions,
        scope,
        isSystem: false,
      });
      await this.recordRole(AUDIT_ACTIONS.ROLE_CREATED, role, null);
      return role;
    });
  }

  /**
   * Copies a role (system or custom) into a new custom role with the same
   * permissions and scope, e.g. a "Vice Principal" from `principal`.
   */
  clone(id: string, dto: CloneRoleDto): Promise<Role> {
    return this.ds.runInTransaction(async () => {
      const source = await this.roleRepo.findByIdOrFail(id);
      await this.assertNameFree(dto.name);
      // Drop keys a catalog change has retired since the source was saved.
      const permissions = source.permissions.filter((p) =>
        PERMISSION_SET.has(p),
      );
      await this.assertCanGrant(permissions, source.scope);
      const role = await this.roleRepo.saveNew({
        name: dto.name,
        description: dto.description ?? source.description,
        permissions,
        scope: source.scope,
        isSystem: false,
      });
      await this.recordRole(AUDIT_ACTIONS.ROLE_CREATED, role, null, {
        clonedFrom: source.id,
      });
      return role;
    });
  }

  update(id: string, dto: UpdateRoleDto): Promise<Role> {
    return this.ds.runInTransaction(() => this.applyUpdate(id, dto));
  }

  private async applyUpdate(id: string, dto: UpdateRoleDto): Promise<Role> {
    const role = await this.roleRepo.findByIdOrFail(id);
    const before = roleSnapshot(role);
    await this.assertCanManage(role);

    if (dto.name !== undefined && dto.name !== role.name) {
      if (role.isSystem) {
        throw new ForbiddenException('System roles cannot be renamed');
      }
      await this.assertNameFree(dto.name);
      role.name = dto.name;
    }

    if (dto.description !== undefined) {
      role.description = dto.description;
    }
    if (dto.permissions !== undefined) {
      const permissions = this.validatePermissions(dto.permissions);
      if (role.name === ADMIN_ROLE_NAME && role.isSystem) {
        throw new ForbiddenException({
          message: 'The admin role always holds every staff permission',
          code: 'SYSTEM_ROLE_LOCKED',
        });
      }
      this.assertRoleShape(role.name, role.isSystem, permissions);
      role.permissions = permissions;
    }
    if (dto.scope !== undefined && dto.scope !== role.scope) {
      if (role.isSystem) {
        throw new ForbiddenException({
          message: 'The scope of a system role cannot be changed',
          code: 'SYSTEM_ROLE_LOCKED',
        });
      }
      role.scope = dto.scope;
    }
    await this.assertCanGrant(role.permissions, role.scope);

    // Nothing changed (same values, or permissions only reordered): no write
    // and no `role.updated` row.
    if (isDeepStrictEqual(roleSnapshot(role), before)) return role;

    const saved = await this.roleRepo.save(role);
    await this.recordRole(AUDIT_ACTIONS.ROLE_UPDATED, saved, before);
    return saved;
  }

  setPermissions(id: string, permissions: string[]): Promise<Role> {
    return this.ds.runInTransaction(() =>
      this.applyUpdate(id, { permissions }),
    );
  }

  remove(id: string, force = false): Promise<void> {
    return this.ds.runInTransaction(async () => {
      const role = await this.roleRepo.findByIdOrFail(id);
      if (role.isSystem) {
        throw new ForbiddenException('System roles cannot be deleted');
      }
      await this.assertCanManage(role);

      const holders = await this.userRoleRepo.findByRoleId(id);
      if (holders.length > 0 && !force) {
        throw new ConflictException(
          `Role is assigned to ${holders.length} user(s). ` +
            `Pass ?force=true to delete it and remove those assignments.`,
        );
      }

      await this.roleRepo.deleteById(id);
      await this.audit.record({
        action: AUDIT_ACTIONS.ROLE_DELETED,
        entityType: 'role',
        entityId: role.id,
        before: {
          ...roleSnapshot(role),
          holderUserIds: holders.map((h) => h.userId),
        },
      });
    });
  }

  getUserRoles(userId: string): Promise<Role[]> {
    return this.userRoleRepo
      .findByUserId(userId)
      .then((assignments) =>
        assignments
          .map((assignment) => assignment.role)
          .filter((role): role is Role => !!role),
      );
  }

  /** Role assignments (with their roles) of the given users. */
  findAssignments(userIds: string[]): Promise<UserRole[]> {
    return this.userRoleRepo.findByUserIds(userIds);
  }

  /** Ids of the users that hold a role. */
  async findUserIdsWithRole(roleId: string): Promise<string[]> {
    const assignments = await this.userRoleRepo.findByRoleId(roleId);
    return assignments.map((a) => a.userId);
  }

  /**
   * Gives a user a role (idempotent). Users are global accounts, so callers
   * must make sure the user is a member of this org first; the user-role
   * endpoints go through `OrgUserService.assignRole`, which does.
   */
  assignRole(userId: string, roleId: string): Promise<void> {
    return this.ds.runInTransaction(async () => {
      const role = await this.findAssignable(roleId);
      if (await this.userRoleRepo.findAssignment(userId, roleId)) return;
      await this.userRoleRepo.assign(userId, roleId);
      await this.recordAssignment(AUDIT_ACTIONS.ROLE_ASSIGNED, userId, role);
    });
  }

  /**
   * Gives a member the guardian or student system role. Unlike
   * `assignRole` it skips the "no more than you hold" check: these roles
   * hold only `portal:*` keys, which reach nothing on staff endpoints, so
   * a receptionist adding a guardian may hand one out. Idempotent.
   */
  assignPortalRole(
    userId: string,
    name: typeof GUARDIAN_ROLE_NAME | typeof STUDENT_ROLE_NAME,
  ): Promise<void> {
    return this.ds.runInTransaction(async () => {
      const role = await this.findSystemRole(name);
      if (!role.permissions.every((key) => key.startsWith('portal:'))) {
        throw new ForbiddenException(`The ${name} role is not portal-only`);
      }
      if (await this.userRoleRepo.findAssignment(userId, role.id)) return;
      await this.userRoleRepo.assign(userId, role.id);
      await this.recordAssignment(AUDIT_ACTIONS.ROLE_ASSIGNED, userId, role);
    });
  }

  unassignRole(userId: string, roleId: string): Promise<void> {
    return this.ds.runInTransaction(() => this.applyUnassign(userId, roleId));
  }

  private async applyUnassign(userId: string, roleId: string): Promise<void> {
    const role = await this.findAssignable(roleId);

    // Prevent locking a tenant out of administration.
    if (role.name === ADMIN_ROLE_NAME) {
      const adminAssignments = await this.userRoleRepo.findByRoleId(roleId);
      const otherAdmins = adminAssignments.filter((a) => a.userId !== userId);
      if (otherAdmins.length === 0) {
        throw new ConflictException(
          'Cannot remove the last admin role assignment',
        );
      }
    }

    if (!(await this.userRoleRepo.findAssignment(userId, roleId))) return;
    await this.userRoleRepo.unassign(userId, roleId);
    await this.recordAssignment(AUDIT_ACTIONS.ROLE_UNASSIGNED, userId, role);
  }

  /**
   * Removes every role of a user, e.g. when they leave the org. Not audited
   * per role: the caller records the removal with the roles it held.
   */
  unassignAll(userId: string): Promise<void> {
    return this.userRoleRepo.unassignAll(userId);
  }

  private recordRole(
    action:
      typeof AUDIT_ACTIONS.ROLE_CREATED | typeof AUDIT_ACTIONS.ROLE_UPDATED,
    role: Role,
    before: ReturnType<typeof roleSnapshot> | null,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    return this.audit.record({
      action,
      entityType: 'role',
      entityId: role.id,
      before,
      after: { ...roleSnapshot(role), ...extra },
    });
  }

  private recordAssignment(
    action:
      typeof AUDIT_ACTIONS.ROLE_ASSIGNED | typeof AUDIT_ACTIONS.ROLE_UNASSIGNED,
    userId: string,
    role: Role,
  ): Promise<void> {
    return this.audit.record({
      action,
      entityType: 'user',
      entityId: userId,
      after: { roleId: role.id, roleName: role.name },
    });
  }

  /**
   * Whether the current user may manage the given roles: give them, take
   * them away, edit or delete them. See `assertCanGrant`.
   */
  async assertCanManageRoles(roles: Role[]): Promise<void> {
    for (const role of roles) await this.assertCanManage(role);
  }

  private assertCanManage(role: Role): Promise<void> {
    return this.assertCanGrant(role.permissions, role.scope);
  }

  /**
   * Nobody hands out more than they hold: outside school admins, every key
   * must be one the current user holds, with school-wide reach when the
   * role is school-wide. Without a signed-in user (seeding, provisioning,
   * jobs) there is nothing to compare against, so it is allowed.
   */
  private async assertCanGrant(
    permissions: string[],
    scope: RoleScope,
  ): Promise<void> {
    const { userId, isAdmin } = this.context.current();
    if (!userId || isAdmin) return;
    const held = await this.resolver.getPermissionScopes(userId);
    const missing = permissions.filter((key) => {
      if (!PERMISSION_SET.has(key)) return false; // retired, grants nothing
      const reach = held.get(key);
      return !reach || (scope === RoleScope.SCHOOL && reach !== scope);
    });
    if (missing.length) {
      throw new ForbiddenException({
        message: `You can't grant permissions you don't hold: ${missing.join(', ')}`,
        code: 'GRANT_EXCEEDS_OWN',
      });
    }
  }

  /**
   * A role is either a portal role (`portal:*` keys only) or a staff role
   * (none). The guardian and student system roles are portal roles.
   */
  private assertRoleShape(
    name: string,
    isSystem: boolean,
    permissions: string[],
  ): void {
    const portal = permissions.filter(isPortalKey).length;
    const mixed = portal > 0 && portal < permissions.length;
    const portalOnly = portal > 0;
    const wrongSystem =
      isSystem &&
      permissions.length > 0 &&
      PORTAL_ROLE_NAMES.has(name) !== portalOnly;
    if (mixed || wrongSystem) {
      throw new BadRequestException({
        message:
          'Portal permissions (portal:*) and staff permissions cannot be mixed, ' +
          'and the guardian and student roles hold only portal permissions',
        code: 'INVALID_ROLE_PERMISSIONS',
      });
    }
  }

  private async assertNameFree(name: string): Promise<void> {
    const existing = await this.roleRepo.findByName(name);
    if (existing) {
      throw new ConflictException(`Role "${name}" already exists`);
    }
  }

  /**
   * De-duplicates and validates permission keys against the catalog.
   * Rejects unknown keys so a typo never silently grants nothing.
   */
  private validatePermissions(permissions: string[]): string[] {
    const unique = [...new Set(permissions)];
    const invalid = unique.filter((p) => !PERMISSION_SET.has(p));
    if (invalid.length) {
      throw new BadRequestException(
        `Unknown permission(s): ${invalid.join(', ')}`,
      );
    }
    return unique;
  }
}
