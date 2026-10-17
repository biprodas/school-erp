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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './permissions.guard';
import { RequirePermissions } from './require-permissions.decorator';
import { PERMISSIONS } from './permissions.catalog';
import { RoleService } from './role.service';
import { AssignRoleDto } from './dto/assign-role.dto';

/** Manages the role assignments of a specific tenant user. */
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
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ROLES_READ)
  async list(@Param('userId', ParseUUIDPipe) userId: string) {
    const roles = await this.roleService.getUserRoles(userId);
    return {
      success: true,
      statusCode: 200,
      message: 'List of user roles',
      data: roles,
    };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ROLES_ASSIGN)
  async assign(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: AssignRoleDto,
  ) {
    await this.roleService.assignRole(userId, dto.roleId);
    return {
      success: true,
      statusCode: 201,
      message: `Role assigned. ID: ${dto.roleId}`,
    };
  }

  @Delete(':roleId')
  @RequirePermissions(PERMISSIONS.ROLES_ASSIGN)
  async unassign(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ) {
    await this.roleService.unassignRole(userId, roleId);
    return {
      success: true,
      statusCode: 200,
      message: `Role unassigned. ID: ${roleId}`,
    };
  }
}
