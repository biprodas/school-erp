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
import { CreateShiftDto } from './dto/create-shift.dto';
import { FilterShiftDto } from './dto/filter-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { ShiftService } from './shift.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

@ApiTags('Tenant / Shifts')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('shifts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ShiftController {
  constructor(private readonly shiftService: ShiftService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SHIFTS_READ)
  @ResponseMessage('List of shifts')
  findAll(@Query() filter: FilterShiftDto) {
    return this.shiftService.findFiltered(filter);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SHIFTS_CREATE)
  @ResponseMessage('Shift created')
  create(@Body() dto: CreateShiftDto) {
    return this.shiftService.create(dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.SHIFTS_READ)
  @ResponseMessage('Shift found')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.shiftService.findById(id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.SHIFTS_UPDATE)
  @ResponseMessage('Shift updated')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateShiftDto) {
    return this.shiftService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.SHIFTS_DELETE)
  @ResponseMessage('Shift deleted')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.shiftService.remove(id);
  }
}
