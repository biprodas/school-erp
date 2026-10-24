import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { AccessScope } from '~/modules/access-scope/access-scope.service';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import {
  DailySummaryQueryDto,
  DefaultersQueryDto,
  LateComersQueryDto,
  MonthlyRegisterPdfDto,
  MonthlyRegisterQueryDto,
} from '../dto/attendance-report.dto';
import { AttendanceReportService } from '../services/attendance-report.service';

/** Attendance reports (PRD 6.7), limited to the caller's sections. */
@ApiTags('Tenant / Attendance')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('attendance/reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AttendanceReportController {
  constructor(
    private readonly reports: AttendanceReportService,
    private readonly scope: AccessScope,
  ) {}

  /** A day's attendance by class and section, with percentages. */
  @Get('daily')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_READ)
  @ResponseMessage('Daily attendance summary')
  async daily(@Query() query: DailySummaryQueryDto) {
    return this.reports.daily(query, await this.allowed());
  }

  /** A section's month as the register grid. */
  @Get('monthly-register')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_READ)
  @ResponseMessage('Monthly register')
  async monthly(@Query() query: MonthlyRegisterQueryDto) {
    await this.assertSection(query.sectionId);
    return this.reports.monthly(query.sectionId, query.month);
  }

  /** The same register as a PDF in the paper layout; poll `GET /jobs/:id`. */
  @Post('monthly-register')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions(PERMISSIONS.ATTENDANCE_READ)
  @ResponseMessage('Monthly register started')
  async monthlyPdf(@Body() dto: MonthlyRegisterPdfDto) {
    await this.assertSection(dto.sectionId);
    return this.reports.startMonthlyPdf(dto);
  }

  /** Students below a percentage (default 75) over a range. */
  @Get('defaulters')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_READ)
  @ResponseMessage('Attendance defaulters')
  async defaulters(@Query() query: DefaultersQueryDto) {
    return this.reports.defaulters(query, await this.allowed());
  }

  @Get('late-comers')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_READ)
  @ResponseMessage('Late-comers')
  async lateComers(@Query() query: LateComersQueryDto) {
    return this.reports.lateComers(query, await this.allowed());
  }

  private allowed() {
    return this.scope.sections(PERMISSIONS.ATTENDANCE_READ);
  }

  private async assertSection(sectionId: string) {
    if (
      !(await this.scope.canAccessSection(
        PERMISSIONS.ATTENDANCE_READ,
        sectionId,
      ))
    ) {
      throw new NotFoundException('Section not found');
    }
  }
}
