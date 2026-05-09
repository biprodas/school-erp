import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RequestContext } from '~/common/decorators/request-context.decorator';
import { Roles } from '~/common/decorators/roles.decorator';
import { RequestContextDto } from '~/common/dto/request-context.dto';
import { PlatformJwtAuthGuard } from '~/common/guards/platform-jwt-auth.guard';
import { RolesGuard } from '~/common/guards/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { FilterUserDto } from './dto/filter-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PlatformRole } from './enums/platform-role.enum';
import { UserService } from './user.service';


@Controller('platform/users')
@UseGuards(PlatformJwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) { }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(PlatformRole.SUPER_ADMIN)
  async findAll(
    @RequestContext() ctx: RequestContextDto,
    @Query() filterUserDto: FilterUserDto
  ) {
    const users = await this.userService.findAll(ctx, filterUserDto)

    return {
      success: true,
      statusCode: 200,
      message: `List of users`,
      data: users,
    }
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(PlatformRole.SUPER_ADMIN)
  async create(
    @RequestContext() ctx: RequestContextDto,
    @Body() createUserDto: CreateUserDto
  ) {
    const user = await this.userService.createPlatformUser(ctx, createUserDto);

    return {
      success: true,
      statusCode: 201,
      message: `User created. ID: ${user.id}`,
      data: user,
    }
  }

  @Get(':id')
  async findOne(
    @RequestContext() ctx: RequestContextDto,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (ctx.user?.role !== PlatformRole.SUPER_ADMIN && ctx.user?.id !== id) {
      throw new ForbiddenException('Access denied');
    }
    const user = await this.userService.findById(ctx, id);

    return {
      success: true,
      statusCode: 200,
      message: `User found. ID: ${user.id}`,
      data: user,
    }
  }

  @Patch(':id')
  async update(
    @RequestContext() ctx: RequestContextDto,
    @Param('id', ParseUUIDPipe) targetId: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const user = await this.userService.update(ctx, targetId, updateUserDto);

    return {
      success: true,
      statusCode: 200,
      message: `User updated. ID: ${user.id}`,
      data: user,
    }
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(PlatformRole.SUPER_ADMIN)
  async remove(
    @RequestContext() ctx: RequestContextDto,
    @Param('id', ParseUUIDPipe) targetId: string,
  ) {
    await this.userService.remove(ctx, targetId);

    return {
      success: true,
      statusCode: 200,
      message: `User deleted. ID: ${targetId}`,
    }
  }
}

