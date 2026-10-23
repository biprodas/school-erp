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
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { CreateRoomDto } from './dto/create-room.dto';
import { FilterRoomDto } from './dto/filter-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomService } from './room.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

@ApiTags('Tenant / Rooms')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('rooms')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ROOMS_READ)
  @ResponseMessage('List of rooms')
  findAll(@Query() filter: FilterRoomDto) {
    return this.roomService.findFiltered(filter);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ROOMS_CREATE)
  @ResponseMessage('Room created')
  create(@Body() dto: CreateRoomDto) {
    return this.roomService.create(dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ROOMS_READ)
  @ResponseMessage('Room found')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.roomService.findById(id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ROOMS_UPDATE)
  @ResponseMessage('Room updated')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoomDto) {
    return this.roomService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.ROOMS_DELETE)
  @ResponseMessage('Room deleted')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.roomService.remove(id);
  }
}
