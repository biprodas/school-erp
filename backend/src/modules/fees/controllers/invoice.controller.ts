import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
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
import { StudentScope } from '~/modules/students/services/student-scope.service';
import {
  CancelDto,
  CreateInvoiceDto,
  FilterInvoiceDto,
  GenerateInvoicesDto,
} from '../dto/invoice.dto';
import { BillingService } from '../services/billing.service';
import { InvoiceService } from '../services/invoice.service';

/** Invoices: generation, ad hoc bills, statements (PRD 6.10). */
@ApiTags('Tenant / Fees')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('invoices')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequireModule(PLAN_MODULES.FEES)
export class InvoiceController {
  constructor(
    private readonly invoices: InvoiceService,
    private readonly billing: BillingService,
    private readonly scope: AccessScope,
    private readonly students: StudentScope,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.FEES_READ)
  @ResponseMessage('Invoices')
  async findAll(@Query() filter: FilterInvoiceDto) {
    return this.invoices.findFiltered(filter, await this.allowed());
  }

  /** Bills the period's fees for every active student (job). */
  @Post('generate')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions(PERMISSIONS.FEES_BILL)
  @ResponseMessage('Invoice generation started')
  generate(@Body() dto: GenerateInvoicesDto) {
    return this.billing.start(dto);
  }

  @Get('billing-runs')
  @RequirePermissions(PERMISSIONS.FEES_READ)
  @ResponseMessage('Billing runs')
  runs() {
    return this.billing.runs();
  }

  /** A student's invoices and balance. */
  @Get('statement/:studentId')
  @RequirePermissions(PERMISSIONS.FEES_READ)
  @ResponseMessage('Fee statement')
  async statement(@Param('studentId', ParseUUIDPipe) studentId: string) {
    await this.students.assert(PERMISSIONS.FEES_READ, studentId);
    return this.invoices.statement(studentId);
  }

  /** An ad hoc invoice (fines, events). */
  @Post()
  @RequirePermissions(PERMISSIONS.FEES_BILL)
  @ResponseMessage('Invoice created')
  create(@Body() dto: CreateInvoiceDto) {
    return this.invoices.create(dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.FEES_READ)
  @ResponseMessage('Invoice')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.invoices.findById(id, await this.allowed());
  }

  /** Only while nothing is paid against it. */
  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.FEES_BILL)
  @ResponseMessage('Invoice cancelled')
  async cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelDto) {
    if ((await this.allowed()) !== null)
      throw new NotFoundException('Invoice not found');
    return this.invoices.cancel(id, dto.reason);
  }

  private allowed() {
    return this.scope.sections(PERMISSIONS.FEES_READ);
  }
}
