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
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { CreatePeriodDto } from '../dto/create-period.dto';
import { UpdatePeriodDto } from '../dto/update-period.dto';
import { PeriodService } from '../services/period.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

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
  @ResponseMessage('List of periods')
  findAll() {
    return this.periodService.findAll();
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PERIODS_CREATE)
  @ResponseMessage('Period created')
  create(@Body() dto: CreatePeriodDto) {
    return this.periodService.create(dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PERIODS_READ)
  @ResponseMessage('Period found')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.periodService.findById(id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.PERIODS_UPDATE)
  @ResponseMessage('Period updated')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePeriodDto) {
    return this.periodService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.PERIODS_DELETE)
  @ResponseMessage('Period deleted')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.periodService.remove(id);
  }
}
