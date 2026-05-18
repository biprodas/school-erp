import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from './permissions.guard';
import { RequirePermissions } from './require-permissions.decorator';
import { PERMISSIONS, getPermissionCatalog } from './permissions.catalog';

/** Exposes the code-defined permission catalog for building role editors. */
@Controller('permissions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PermissionController {
  @Get()
  @RequirePermissions(PERMISSIONS.ROLES_READ)
  getCatalog() {
    return getPermissionCatalog();
  }
}
