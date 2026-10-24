import {
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { RequireModule } from '~/modules/plans/decorators/require-module.decorator';
import { PLAN_MODULES } from '~/modules/plans/plans.catalog';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { AccessScope } from '~/modules/access-scope/access-scope.service';
import {
  DailyCollectionDto,
  DateRangeDto,
  DefaultersQueryDto,
  DuesQueryDto,
  PeriodRangeDto,
} from '../dto/report.dto';
import { FeeIntegrityService } from '../services/fee-integrity.service';
import { FeeReportService } from '../services/fee-report.service';

/** Dues and fee reports (PRD 6.10). Totals need `fees:read` school-wide. */
@ApiTags('Tenant / Fees')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('fees')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequireModule(PLAN_MODULES.FEES)
export class FeeReportController {
  constructor(
    private readonly reports: FeeReportService,
    private readonly integrity: FeeIntegrityService,
    private readonly scope: AccessScope,
  ) {}

  /** Who owes what, with aging buckets (0–30, 31–60, 61–90, 90+ days). */
  @Get('dues')
  @RequirePermissions(PERMISSIONS.FEES_READ)
  @ResponseMessage('Dues')
  async dues(@Query() query: DuesQueryDto) {
    return this.reports.dues(query, await this.allowed());
  }

  @Get('reports/defaulters')
  @RequirePermissions(PERMISSIONS.FEES_READ)
  @ResponseMessage('Fee defaulters')
  async defaulters(@Query() query: DefaultersQueryDto) {
    return this.reports.defaulters(query, await this.allowed());
  }

  @Get('reports/collection-vs-demand')
  @RequirePermissions(PERMISSIONS.FEES_READ)
  @ResponseMessage('Collection vs demand')
  async collectionVsDemand(@Query() query: PeriodRangeDto) {
    return this.reports.collectionVsDemand(query, await this.allowed());
  }

  @Get('reports/head-wise')
  @RequirePermissions(PERMISSIONS.FEES_READ)
  @ResponseMessage('Head-wise collection')
  async headWise(@Query() query: DateRangeDto) {
    return this.reports.headWise(query, await this.allowed());
  }

  @Get('reports/discounts')
  @RequirePermissions(PERMISSIONS.FEES_READ)
  @ResponseMessage('Discount report')
  async discounts(@Query() query: PeriodRangeDto) {
    return this.reports.discounts(query, await this.allowed());
  }

  /** Each collector's payments and receipts for a day. */
  @Get('reports/daily-collection')
  @RequirePermissions(PERMISSIONS.FEES_READ)
  @ResponseMessage('Daily collection')
  async dailyCollection(@Query() query: DailyCollectionDto) {
    return this.reports.dailyCollection(query, await this.allowed());
  }

  /** Recomputes cached totals from allocations and adjustments (also nightly). */
  @Post('integrity-check')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.FEES_SETUP)
  @ResponseMessage('Fee totals checked')
  check() {
    return this.integrity.check();
  }

  private allowed() {
    return this.scope.sections(PERMISSIONS.FEES_READ);
  }
}
