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
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import {
  CreateAttendanceStatusDto,
  UpdateAttendanceStatusDto,
} from '../dto/attendance-status.dto';
import { AttendanceStatusService } from '../services/attendance-status.service';

/** Attendance statuses: the five system ones and the school's own. */
@ApiTags('Tenant / Attendance')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('attendance/statuses')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AttendanceStatusController {
  constructor(private readonly statuses: AttendanceStatusService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ATTENDANCE_READ)
  @ResponseMessage('Attendance statuses')
  findAll() {
    return this.statuses.list();
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ATTENDANCE_STATUSES_CREATE)
  @ResponseMessage('Attendance status created')
  create(@Body() dto: CreateAttendanceStatusDto) {
    return this.statuses.create(dto);
  }

  /** Custom statuses only; the code can't change. */
  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_STATUSES_UPDATE)
  @ResponseMessage('Attendance status updated')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAttendanceStatusDto,
  ) {
    return this.statuses.update(id, dto);
  }

  /** Only while unused (`STATUS_IN_USE`); deactivate it otherwise. */
  @Delete(':id')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_STATUSES_DELETE)
  @ResponseMessage('Attendance status deleted')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.statuses.remove(id);
  }
}
