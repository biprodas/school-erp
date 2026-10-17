import { Injectable } from '@nestjs/common';
import { Role } from './entities/role.entity';
import { UserRoleRepository } from './user-role.repository';

/**
 * Resolves a tenant user's effective permissions and roles for the current
 * request. Effective permissions are the union of every assigned role's
 * permission list. Resolved fresh per request (against the request-scoped
 * tenant connection) so permission changes take effect immediately.
 */
@Injectable()
export class PermissionResolverService {
  constructor(private readonly userRoleRepo: UserRoleRepository) {}

  async getEffectivePermissions(userId: string): Promise<Set<string>> {
    const assignments = await this.userRoleRepo.findByUserId(userId);
    const permissions = new Set<string>();
    for (const assignment of assignments) {
      if (!assignment.role) {
        continue;
      }
      for (const permission of assignment.role.permissions ?? []) {
        permissions.add(permission);
      }
    }
    return permissions;
  }

  async getRoles(userId: string): Promise<Role[]> {
    const assignments = await this.userRoleRepo.findByUserId(userId);
    return assignments
      .map((assignment) => assignment.role)
      .filter((role): role is Role => !!role);
  }
}
