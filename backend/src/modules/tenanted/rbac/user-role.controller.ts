import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
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
  list(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.roleService.getUserRoles(userId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ROLES_ASSIGN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async assign(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: AssignRoleDto,
  ) {
    await this.roleService.assignRole(userId, dto.roleId);
  }

  @Delete(':roleId')
  @RequirePermissions(PERMISSIONS.ROLES_ASSIGN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async unassign(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ) {
    await this.roleService.unassignRole(userId, roleId);
  }
}
