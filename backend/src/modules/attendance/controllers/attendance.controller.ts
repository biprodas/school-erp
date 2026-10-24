import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { AccessScope } from '~/modules/access-scope/access-scope.service';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { Idempotent } from '~/modules/idempotency/idempotent.decorator';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import {
  PERMISSIONS,
  type PermissionKey,
} from '~/modules/rbac/permissions.catalog';
import {
  RegisterQueryDto,
  SubmissionStatusQueryDto,
  SubmitAttendanceDto,
} from '../dto/attendance.dto';
import { AttendanceService } from '../services/attendance.service';

/** Taking a section's attendance (PRD 6.7, workflow 7.2). */
@ApiTags('Tenant / Attendance')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('attendance')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AttendanceController {
  constructor(
    private readonly attendance: AttendanceService,
    private readonly scope: AccessScope,
  ) {}

  /** Sections of the session and whether today's register is in. */
  @Get('submission-status')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_READ)
  @ResponseMessage('Attendance submission status')
  async submissionStatus(@Query() query: SubmissionStatusQueryDto) {
    return this.attendance.submissionStatus(
      query,
      await this.scope.sections(PERMISSIONS.ATTENDANCE_READ),
    );
  }

  /** The roster with saved statuses; Present (or Leave) by default. */
  @Get('sections/:sectionId')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_READ)
  @ResponseMessage('Attendance register')
  async roster(
    @Param('sectionId', ParseUUIDPipe) sectionId: string,
    @Query() query: RegisterQueryDto,
  ) {
    await this.assertSection(PERMISSIONS.ATTENDANCE_READ, sectionId);
    return this.attendance.roster(sectionId, query);
  }

  /**
   * Saves the register: send the exceptions only. Changing a recorded
   * status needs `reason` and is kept as a correction.
   */
  @Put('sections/:sectionId')
  @Idempotent()
  @RequirePermissions(PERMISSIONS.ATTENDANCE_TAKE)
  @ResponseMessage('Attendance saved')
  async submit(
    @Param('sectionId', ParseUUIDPipe) sectionId: string,
    @Query() query: RegisterQueryDto,
    @Body() dto: SubmitAttendanceDto,
  ) {
    await this.assertSection(PERMISSIONS.ATTENDANCE_TAKE, sectionId);
    return this.attendance.submit(sectionId, query, dto, {
      canEditLocked: await this.scope.can(PERMISSIONS.ATTENDANCE_EDIT_LOCKED),
    });
  }

  /** Who changed which status in the register, when and why. */
  @Get('sections/:sectionId/corrections')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_READ)
  @ResponseMessage('Attendance corrections')
  async corrections(
    @Param('sectionId', ParseUUIDPipe) sectionId: string,
    @Query() query: RegisterQueryDto,
  ) {
    await this.assertSection(PERMISSIONS.ATTENDANCE_READ, sectionId);
    return this.attendance.corrections(sectionId, query);
  }

  private async assertSection(key: PermissionKey, sectionId: string) {
    if (!(await this.scope.canAccessSection(key, sectionId))) {
      throw new NotFoundException('Section not found');
    }
  }
}
