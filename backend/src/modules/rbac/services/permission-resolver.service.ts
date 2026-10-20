import { Injectable } from '@nestjs/common';
import { Role } from '../entities/role.entity';
import { RoleScope } from '../enums/role-scope.enum';
import { UserRoleRepository } from '../repositories/user-role.repository';

/** Wider scopes rank higher; a user gets the widest among their roles. */
const SCOPE_RANK: Record<RoleScope, number> = {
  [RoleScope.ASSIGNED]: 0,
  [RoleScope.SCHOOL]: 1,
};

/**
 * Resolves a tenant user's effective permissions and roles for the current
 * request. Effective permissions are the union of every assigned role's
 * permission list; each key carries the widest scope among the roles that
 * grant it. Resolved fresh per request (against the request-scoped tenant
 * connection, and memoized for the rest of the request) so permission
 * changes take effect on the next request.
 */
@Injectable()
export class PermissionResolverService {
  private readonly rolesByUser = new Map<string, Promise<Role[]>>();

  constructor(private readonly userRoleRepo: UserRoleRepository) {}

  async getEffectivePermissions(userId: string): Promise<Set<string>> {
    return new Set((await this.getPermissionScopes(userId)).keys());
  }

  /** Every key the user holds, mapped to the widest scope granting it. */
  async getPermissionScopes(userId: string): Promise<Map<string, RoleScope>> {
    const scopes = new Map<string, RoleScope>();
    for (const role of await this.getRoles(userId)) {
      const scope = role.scope ?? RoleScope.SCHOOL;
      for (const permission of role.permissions ?? []) {
        const current = scopes.get(permission);
        if (!current || SCOPE_RANK[scope] > SCOPE_RANK[current]) {
          scopes.set(permission, scope);
        }
      }
    }
    return scopes;
  }

  getRoles(userId: string): Promise<Role[]> {
    let roles = this.rolesByUser.get(userId);
    if (!roles) {
      roles = this.userRoleRepo
        .findByUserId(userId)
        .then((assignments) =>
          assignments
            .map((assignment) => assignment.role)
            .filter((role): role is Role => !!role),
        );
      // A failed lookup isn't cached, so a retry within the request re-reads.
      roles.catch(() => this.rolesByUser.delete(userId));
      this.rolesByUser.set(userId, roles);
    }
    return roles;
  }
}
