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
import { PERMISSIONS } from '../rbac/permissions.catalog';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { CreateTimetableDto } from './dto/create-timetable.dto';
import { FilterTimetableDto } from './dto/filter-timetable.dto';
import { UpdateTimetableDto } from './dto/update-timetable.dto';
import { ClassTimetableService } from './class-timetable.service';

@ApiTags('Tenant / Timetables')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('timetables')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ClassTimetableController {
  constructor(private readonly timetableService: ClassTimetableService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.TIMETABLES_READ)
  async findAll(@Query() filter: FilterTimetableDto) {
    const items = await this.timetableService.findFiltered(filter);
    return {
      success: true,
      statusCode: 200,
      message: 'List of timetable entries',
      data: items,
    };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.TIMETABLES_CREATE)
  async create(@Body() dto: CreateTimetableDto) {
    const item = await this.timetableService.create(dto);
    return {
      success: true,
      statusCode: 201,
      message: `Timetable entry created. ID: ${item.id}`,
      data: item,
    };
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.TIMETABLES_READ)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const item = await this.timetableService.findById(id);
    return {
      success: true,
      statusCode: 200,
      message: `Timetable entry found. ID: ${item.id}`,
      data: item,
    };
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.TIMETABLES_UPDATE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTimetableDto,
  ) {
    const item = await this.timetableService.update(id, dto);
    return {
      success: true,
      statusCode: 200,
      message: `Timetable entry updated. ID: ${item.id}`,
      data: item,
    };
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.TIMETABLES_DELETE)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.timetableService.remove(id);
    return {
      success: true,
      statusCode: 200,
      message: `Timetable entry deleted. ID: ${id}`,
    };
  }
}
