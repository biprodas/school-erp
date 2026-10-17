import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PERMISSIONS } from '../rbac/permissions.catalog';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { CreatePeriodDto } from './dto/create-period.dto';
import { UpdatePeriodDto } from './dto/update-period.dto';
import { PeriodService } from './period.service';

@ApiTags('Tenant / Periods')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('periods')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PeriodController {
  constructor(private readonly periodService: PeriodService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PERIODS_READ)
  async findAll() {
    const items = await this.periodService.findAll();
    return {
      success: true,
      statusCode: 200,
      message: 'List of periods',
      data: items,
    };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PERIODS_CREATE)
  async create(@Body() dto: CreatePeriodDto) {
    const item = await this.periodService.create(dto);
    return {
      success: true,
      statusCode: 201,
      message: `Period created. ID: ${item.id}`,
      data: item,
    };
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PERIODS_READ)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const item = await this.periodService.findById(id);
    return {
      success: true,
      statusCode: 200,
      message: `Period found. ID: ${item.id}`,
      data: item,
    };
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.PERIODS_UPDATE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePeriodDto,
  ) {
    const item = await this.periodService.update(id, dto);
    return {
      success: true,
      statusCode: 200,
      message: `Period updated. ID: ${item.id}`,
      data: item,
    };
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.PERIODS_DELETE)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.periodService.remove(id);
    return {
      success: true,
      statusCode: 200,
      message: `Period deleted. ID: ${id}`,
    };
  }
}
