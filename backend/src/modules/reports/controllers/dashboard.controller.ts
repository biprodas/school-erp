import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '~/common/auth/auth-user';
import { CurrentUser } from '~/common/decorators/current-user.decorator';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { ReportExportDto } from '../dto/report-export.dto';
import { DashboardService } from '../services/dashboard.service';
import { ReportExportService } from '../services/report-export.service';

/** Role dashboards (PRD 6.22), cached for 60 seconds. */
@ApiTags('Tenant / Dashboards')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('dashboards')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboards: DashboardService) {}

  @Get('admin')
  @RequirePermissions(PERMISSIONS.DASHBOARD_ADMIN)
  @ResponseMessage('Admin dashboard')
  admin() {
    return this.dashboards.admin();
  }

  @Get('teacher')
  @RequirePermissions(PERMISSIONS.DASHBOARD_TEACHER)
  @ResponseMessage('Teacher dashboard')
  teacher(@CurrentUser() user: AuthUser) {
    return this.dashboards.teacher(user.userId);
  }

  @Get('accountant')
  @RequirePermissions(PERMISSIONS.DASHBOARD_ACCOUNTANT)
  @ResponseMessage('Accountant dashboard')
  accountant() {
    return this.dashboards.accountant();
  }
}

/** Large reports as Excel, in the background. */
@ApiTags('Tenant / Dashboards')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportExportController {
  constructor(private readonly exports: ReportExportService) {}

  /** Needs the report's own read key; poll `GET /jobs/:id`. */
  @Post('exports')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions(PERMISSIONS.FEES_READ, PERMISSIONS.ATTENDANCE_READ)
  @ResponseMessage('Export started')
  start(@Body() dto: ReportExportDto) {
    return this.exports.start(dto);
  }
}
