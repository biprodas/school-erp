import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { IsAdminGuard } from '../../rbac/is-admin.guard';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { RequirePermissions } from '../../rbac/require-permissions.decorator';
import { PERMISSIONS } from '../../rbac/permissions.catalog';
import { CreateOrgUserDto } from '../dto/create-org-user.dto';
import { FilterOrgUserDto } from '../dto/filter-org-user.dto';
import { UpdateOrgUserDto } from '../dto/update-org-user.dto';
import { OrgUserService } from '../services/org-user.service';

@ApiTags('Tenant / Users')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrgUserController {
  constructor(private readonly userService: OrgUserService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USERS_READ)
  async findAll(@Query() filterUserDto: FilterOrgUserDto) {
    const users = await this.userService.findFiltered(filterUserDto);

    return {
      success: true,
      statusCode: 200,
      message: 'List of users',
      data: users,
    };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.USERS_CREATE)
  async create(@Body() createUserDto: CreateOrgUserDto) {
    const user = await this.userService.create(createUserDto);

    return {
      success: true,
      statusCode: 201,
      message: `User created. ID: ${user.id}`,
      data: user,
    };
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.USERS_READ)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.userService.findById(id);

    return {
      success: true,
      statusCode: 200,
      message: `User found. ID: ${user.id}`,
      data: user,
    };
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.USERS_UPDATE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateOrgUserDto,
  ) {
    const user = await this.userService.update(id, updateUserDto);

    return {
      success: true,
      statusCode: 200,
      message: `User updated. ID: ${user.id}`,
      data: user,
    };
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.USERS_DELETE)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.userService.remove(id);

    return {
      success: true,
      statusCode: 200,
      message: `User deleted. ID: ${id}`,
    };
  }

  @Post(':id/grant-admin')
  @UseGuards(IsAdminGuard)
  async grantAdmin(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.userService.grantAdmin(id);
    return {
      success: true,
      statusCode: 200,
      message: `Admin granted. ID: ${user.id}`,
      data: user,
    };
  }

  @Post(':id/revoke-admin')
  @UseGuards(IsAdminGuard)
  async revokeAdmin(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.userService.revokeAdmin(id);
    return {
      success: true,
      statusCode: 200,
      message: `Admin revoked. ID: ${user.id}`,
      data: user,
    };
  }
}
