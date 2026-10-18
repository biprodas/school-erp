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
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { IsAdminGuard } from '~/modules/rbac/guards/is-admin.guard';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { CreateOrgUserDto } from '../dto/create-org-user.dto';
import { FilterOrgUserDto } from '../dto/filter-org-user.dto';
import { UpdateOrgUserDto } from '../dto/update-org-user.dto';
import { OrgUserService } from '../services/org-user.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

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
  @ResponseMessage('List of users')
  findAll(@Query() filterUserDto: FilterOrgUserDto) {
    return this.userService.findFiltered(filterUserDto);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.USERS_CREATE)
  @ResponseMessage('User created')
  create(@Body() createUserDto: CreateOrgUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.USERS_READ)
  @ResponseMessage('User found')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.findById(id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.USERS_UPDATE)
  @ResponseMessage('User updated')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateOrgUserDto,
  ) {
    return this.userService.update(id, updateUserDto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.USERS_DELETE)
  @ResponseMessage('User deleted')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.userService.remove(id);
  }

  @Post(':id/grant-admin')
  @UseGuards(IsAdminGuard)
  @ResponseMessage('Admin granted')
  grantAdmin(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.grantAdmin(id);
  }

  @Post(':id/revoke-admin')
  @UseGuards(IsAdminGuard)
  @ResponseMessage('Admin revoked')
  revokeAdmin(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.revokeAdmin(id);
  }
}
