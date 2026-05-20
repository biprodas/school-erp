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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { PERMISSIONS } from '../rbac/permissions.catalog';
import { CreateUserDto } from './dto/create-user.dto';
import { FilterUserDto } from './dto/filter-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserService } from './user.service';

@ApiTags('Tenant / Users')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USERS_READ)
  async findAll(@Query() filterUserDto: FilterUserDto) {
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
  async create(@Body() createUserDto: CreateUserDto) {
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
    @Body() updateUserDto: UpdateUserDto,
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
}
