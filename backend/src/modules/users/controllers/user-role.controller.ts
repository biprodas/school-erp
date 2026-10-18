import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { AssignRoleDto } from '~/modules/rbac/dto/assign-role.dto';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { RoleService } from '~/modules/rbac/services/role.service';
import { OrgUserService } from '../services/org-user.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

/**
 * Manages the role assignments of a specific tenant user. Lives in the users
 * module because assigning needs the org membership check (OrgUserService).
 */
@ApiTags('Tenant / User Roles')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('users/:userId/roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UserRoleController {
  constructor(
    private readonly roleService: RoleService,
    private readonly orgUserService: OrgUserService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ROLES_READ)
  @ResponseMessage('List of user roles')
  list(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.roleService.getUserRoles(userId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ROLES_ASSIGN)
  @ResponseMessage('Role assigned')
  async assign(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: AssignRoleDto,
  ) {
    await this.orgUserService.assignRole(userId, dto.roleId);
  }

  @Delete(':roleId')
  @RequirePermissions(PERMISSIONS.ROLES_ASSIGN)
  @ResponseMessage('Role unassigned')
  async unassign(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ) {
    await this.roleService.unassignRole(userId, roleId);
  }
}
