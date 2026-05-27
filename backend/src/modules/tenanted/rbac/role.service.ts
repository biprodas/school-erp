import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Role } from './entities/role.entity';
import { RoleRepository } from './role.repository';
import { UserRoleRepository } from './user-role.repository';
import { PERMISSION_SET } from './permissions.catalog';
import { ADMIN_ROLE_NAME } from './system-roles.seed';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RoleService {
  private readonly logger = new Logger(RoleService.name);

  constructor(
    private readonly roleRepo: RoleRepository,
    private readonly userRoleRepo: UserRoleRepository,
  ) {}

  findAll(): Promise<Role[]> {
    return this.roleRepo.findAll({ order: { name: 'ASC' } });
  }

  findById(id: string): Promise<Role> {
    return this.roleRepo.findByIdOrFail(id);
  }

  async create(dto: CreateRoleDto): Promise<Role> {
    const existing = await this.roleRepo.findByName(dto.name);
    if (existing) {
      throw new ConflictException(`Role "${dto.name}" already exists`);
    }
    return this.roleRepo.saveNew({
      name: dto.name,
      description: dto.description ?? null,
      permissions: this.validatePermissions(dto.permissions ?? []),
      isSystem: false,
    });
  }

  async update(id: string, dto: UpdateRoleDto): Promise<Role> {
    const role = await this.roleRepo.findByIdOrFail(id);

    if (dto.name !== undefined && dto.name !== role.name) {
      if (role.isSystem) {
        throw new ForbiddenException('System roles cannot be renamed');
      }
      const conflict = await this.roleRepo.findByName(dto.name);
      if (conflict) {
        throw new ConflictException(`Role "${dto.name}" already exists`);
      }
      role.name = dto.name;
    }

    if (dto.description !== undefined) {
      role.description = dto.description;
    }
    if (dto.permissions !== undefined) {
      role.permissions = this.validatePermissions(dto.permissions);
    }

    return this.roleRepo.save(role);
  }

  async setPermissions(id: string, permissions: string[]): Promise<Role> {
    const role = await this.roleRepo.findByIdOrFail(id);
    role.permissions = this.validatePermissions(permissions);
    return this.roleRepo.save(role);
  }

  async remove(id: string, force = false): Promise<void> {
    const role = await this.roleRepo.findByIdOrFail(id);
    if (role.isSystem) {
      throw new ForbiddenException('System roles cannot be deleted');
    }

    const assignedCount = await this.userRoleRepo.countByRoleId(id);
    if (assignedCount > 0 && !force) {
      throw new ConflictException(
        `Role is assigned to ${assignedCount} user(s). ` +
          `Pass ?force=true to delete it and remove those assignments.`,
      );
    }

    await this.roleRepo.deleteById(id);
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

  async assignRole(userId: string, roleId: string): Promise<void> {
    await this.roleRepo.findByIdOrFail(roleId);
    await this.userRoleRepo.assign(userId, roleId);
  }

  async unassignRole(userId: string, roleId: string): Promise<void> {
    const role = await this.roleRepo.findByIdOrFail(roleId);

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

    await this.userRoleRepo.unassign(userId, roleId);
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
