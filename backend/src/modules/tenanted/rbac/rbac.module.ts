import { Module } from '@nestjs/common';
import { RoleController } from './role.controller';
import { UserRoleController } from './user-role.controller';
import { PermissionController } from './permission.controller';
import { RoleService } from './role.service';
import { RoleRepository } from './role.repository';
import { UserRoleRepository } from './user-role.repository';
import { IsAdminGuard } from './is-admin.guard';
import { PermissionResolverService } from './permission-resolver.service';
import { PermissionsGuard } from './permissions.guard';
import { RbacSeederService } from './rbac-seeder.service';

/**
 * Tenant-scoped role-based access control: role/permission management,
 * the permission guard, and the system-role seeder. Imported by any module
 * that needs `PermissionsGuard` or assigns roles to users.
 */
@Module({
  controllers: [RoleController, UserRoleController, PermissionController],
  providers: [
    RoleService,
    RoleRepository,
    UserRoleRepository,
    PermissionResolverService,
    PermissionsGuard,
    IsAdminGuard,
    RbacSeederService,
  ],
  exports: [
    RoleService,
    RoleRepository,
    UserRoleRepository,
    PermissionResolverService,
    PermissionsGuard,
    IsAdminGuard,
    RbacSeederService,
  ],
})
export class RbacModule {}
