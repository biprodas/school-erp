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
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { FilterHolidayDto } from './dto/filter-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';
import { HolidayService } from './holiday.service';

/** The school's holiday calendar (PRD 6.7). */
@ApiTags('Tenant / Holidays')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('holidays')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class HolidayController {
  constructor(private readonly holidays: HolidayService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.HOLIDAYS_READ)
  @ResponseMessage('Holidays')
  findAll(@Query() filter: FilterHolidayDto) {
    return this.holidays.findFiltered(filter);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.HOLIDAYS_CREATE)
  @ResponseMessage('Holiday created')
  create(@Body() dto: CreateHolidayDto) {
    return this.holidays.create(dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.HOLIDAYS_READ)
  @ResponseMessage('Holiday found')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.holidays.findById(id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.HOLIDAYS_UPDATE)
  @ResponseMessage('Holiday updated')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHolidayDto,
  ) {
    return this.holidays.update(id, dto);
  }

  /** Registers already taken on its days stay as they are. */
  @Delete(':id')
  @RequirePermissions(PERMISSIONS.HOLIDAYS_DELETE)
  @ResponseMessage('Holiday deleted')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.holidays.remove(id);
  }
}
