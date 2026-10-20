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
import { ReqContext } from '~/common/decorators/request-context.decorator';
import { RequestContextDto } from '~/common/dto/request-context.dto';
import { PlatformJwtAuthGuard } from '~/common/guards/platform-jwt-auth.guard';
import { PlatformAdminGuard } from '~/common/guards/platform-admin.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateUserDto } from '../dto/create-user.dto';
import { FilterUserDto } from '../dto/filter-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserService } from '../services/user.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

@ApiTags('Platform / Users')
@ApiBearerAuth('platform-jwt')
@Controller('platform/users')
@UseGuards(PlatformJwtAuthGuard)
export class PlatformUserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @UseGuards(PlatformAdminGuard)
  @ResponseMessage('List of users')
  findAll(
    @ReqContext() ctx: RequestContextDto,
    @Query() filterUserDto: FilterUserDto,
  ) {
    return this.userService.findAll(ctx, filterUserDto);
  }

  @Post()
  @UseGuards(PlatformAdminGuard)
  @ResponseMessage('User created')
  create(
    @ReqContext() ctx: RequestContextDto,
    @Body() createUserDto: CreateUserDto,
  ) {
    return this.userService.createPlatformUser(ctx, createUserDto);
  }

  @Get(':id')
  @ResponseMessage('User found')
  findOne(
    @ReqContext() ctx: RequestContextDto,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!ctx.user?.isAdmin && ctx.user?.id !== id) {
      throw new ForbiddenException('Access denied');
    }
    return this.userService.findById(ctx, id);
  }

  @Patch(':id')
  @ResponseMessage('User updated')
  update(
    @ReqContext() ctx: RequestContextDto,
    @Param('id', ParseUUIDPipe) targetId: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.update(ctx, targetId, updateUserDto);
  }

  @Delete(':id')
  @UseGuards(PlatformAdminGuard)
  @ResponseMessage('User deleted')
  async remove(
    @ReqContext() ctx: RequestContextDto,
    @Param('id', ParseUUIDPipe) targetId: string,
  ) {
    await this.userService.remove(ctx, targetId);
  }
}
