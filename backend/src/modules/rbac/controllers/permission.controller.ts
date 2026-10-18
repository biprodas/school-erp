import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { RequirePermissions } from '../decorators/require-permissions.decorator';
import { PERMISSIONS, getPermissionCatalog } from '../permissions.catalog';

/** Exposes the code-defined permission catalog for building role editors. */
@ApiTags('Tenant / Permissions')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('permissions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PermissionController {
  @Get()
  @RequirePermissions(PERMISSIONS.ROLES_READ)
  getCatalog() {
    return getPermissionCatalog();
  }
}
