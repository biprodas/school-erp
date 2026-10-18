import { Module } from '@nestjs/common';
import { RoleController } from './controllers/role.controller';
import { PermissionController } from './controllers/permission.controller';
import { RoleService } from './services/role.service';
import { RoleRepository } from './repositories/role.repository';
import { UserRoleRepository } from './repositories/user-role.repository';
import { IsAdminGuard } from './guards/is-admin.guard';
import { PermissionResolverService } from './services/permission-resolver.service';
import { PermissionsGuard } from './guards/permissions.guard';
import { RbacSeederService } from './services/rbac-seeder.service';

/**
 * Tenant-scoped role-based access control: role/permission management,
 * the permission guard, and the system-role seeder. Imported by any module
 * that needs `PermissionsGuard` or works with roles (through `RoleService`).
 * It doesn't know about users or memberships; the user-role endpoints live
 * in UserModule.
 */
@Module({
  controllers: [RoleController, PermissionController],
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
    PermissionResolverService,
    PermissionsGuard,
    IsAdminGuard,
    RbacSeederService,
  ],
})
export class RbacModule {}
