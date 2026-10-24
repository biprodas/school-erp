import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '~/common/auth/auth-user';
import { CurrentUser } from '~/common/decorators/current-user.decorator';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { NoticeService } from '~/modules/notices/services/notice.service';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import {
  PortalAttendanceQueryDto,
  PortalHandoffDto,
  PortalLeaveDto,
  PortalReceiptPdfDto,
} from '../dto/portal.dto';
import { PortalAccessService } from '../services/portal-access.service';
import { PortalService } from '../services/portal.service';

/**
 * The guardian and student portal (PRD 6.14). Every route needs
 * `portal:access` and reaches only the user's own children; any other
 * student is 404.
 */
@ApiTags('Tenant / Portal')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('portal')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.PORTAL_ACCESS)
export class PortalController {
  constructor(
    private readonly access: PortalAccessService,
    private readonly portal: PortalService,
    private readonly notices: NoticeService,
  ) {}

  /** This school's children (a student sees themself). */
  @Get('children')
  @ResponseMessage('Children')
  children() {
    return this.access.children();
  }

  /** Children at the user's other schools, with the host to switch to. */
  @Get('schools')
  @ResponseMessage('Other schools')
  schools() {
    return this.access.otherSchools();
  }

  /** A one-time code to switch to another school (`redirectUrl`). */
  @Post('handoff')
  @HttpCode(200)
  @ResponseMessage('Handoff code issued')
  handoff(@Body() dto: PortalHandoffDto) {
    return this.access.handoff(dto.orgId);
  }

  @Get('children/:id/dashboard')
  @ResponseMessage('Child dashboard')
  dashboard(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.portal.dashboard(id, user.userId);
  }

  @Get('children/:id/attendance')
  @ResponseMessage('Attendance')
  attendance(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PortalAttendanceQueryDto,
  ) {
    return this.portal.attendance(id, query.month);
  }

  @Get('children/:id/results')
  @ResponseMessage('Results')
  results(@Param('id', ParseUUIDPipe) id: string) {
    return this.portal.results(id);
  }

  @Get('children/:id/results/:resultId')
  @ResponseMessage('Result')
  result(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('resultId', ParseUUIDPipe) resultId: string,
  ) {
    return this.portal.result(id, resultId);
  }

  @Get('children/:id/results/:resultId/report-card')
  @ResponseMessage('Download link')
  reportCard(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('resultId', ParseUUIDPipe) resultId: string,
  ) {
    return this.portal.reportCard(id, resultId);
  }

  /** Invoices and the balance. */
  @Get('children/:id/fees')
  @ResponseMessage('Fees')
  fees(@Param('id', ParseUUIDPipe) id: string) {
    return this.portal.fees(id);
  }

  @Get('children/:id/leave')
  @ResponseMessage('Leave requests')
  leaves(@Param('id', ParseUUIDPipe) id: string) {
    return this.portal.leaves(id);
  }

  /** The class teacher approves or rejects it. */
  @Post('children/:id/leave')
  @ResponseMessage('Leave requested')
  applyLeave(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PortalLeaveDto,
  ) {
    return this.portal.applyLeave(id, dto);
  }

  /** Payments for any of the user's children, with receipts. */
  @Get('payments')
  @ResponseMessage('Payments')
  payments() {
    return this.portal.payments();
  }

  /** A receipt PDF (job); poll `GET /jobs/:id`. */
  @Post('receipts/:id/pdf')
  @HttpCode(HttpStatus.ACCEPTED)
  @ResponseMessage('Receipt PDF started')
  receiptPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PortalReceiptPdfDto,
  ) {
    return this.portal.receiptPdf(id, dto.paper ?? 'A4');
  }

  @Get('notices')
  @ResponseMessage('Notices')
  noticesFeed(
    @CurrentUser() user: AuthUser,
    @Query() page: PaginationQueryDto,
  ) {
    return this.notices.feed(user.userId, page);
  }

  @Get('notices/:id')
  @ResponseMessage('Notice')
  notice(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notices.findForViewer(id, user.userId);
  }
}
