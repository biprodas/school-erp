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
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { RequireModule } from '~/modules/plans/decorators/require-module.decorator';
import { PLAN_MODULES } from '~/modules/plans/plans.catalog';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { Idempotent } from '~/modules/idempotency/idempotent.decorator';
import {
  CreatePaymentDto,
  FilterPaymentDto,
  ReceiptPdfDto,
} from '../dto/payment.dto';
import { CancelDto } from '../dto/invoice.dto';
import { PaymentService } from '../services/payment.service';

/**
 * Counter collection and receipts (PRD 6.10). Payments are never edited
 * or deleted; cancelling the receipt reverses one.
 */
@ApiTags('Tenant / Fees')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('payments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequireModule(PLAN_MODULES.FEES)
export class PaymentController {
  constructor(private readonly payments: PaymentService) {}

  /** Records, allocates and issues the receipt (returned). */
  @Post()
  @Idempotent()
  @RequirePermissions(PERMISSIONS.FEES_COLLECT)
  @ResponseMessage('Payment recorded')
  collect(@Body() dto: CreatePaymentDto) {
    return this.payments.collect(dto);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.FEES_COLLECT, PERMISSIONS.LEDGER_READ)
  @ResponseMessage('Payments')
  findAll(@Query() filter: FilterPaymentDto) {
    return this.payments.findPayments(filter);
  }

  @Get(':id/receipt')
  @RequirePermissions(PERMISSIONS.FEES_COLLECT, PERMISSIONS.LEDGER_READ)
  @ResponseMessage('Receipt')
  receipt(@Param('id', ParseUUIDPipe) id: string) {
    return this.payments.receiptForPayment(id);
  }
}

@ApiTags('Tenant / Fees')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('receipts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequireModule(PLAN_MODULES.FEES)
export class ReceiptController {
  constructor(private readonly payments: PaymentService) {}

  @Get(':id')
  @RequirePermissions(PERMISSIONS.FEES_COLLECT, PERMISSIONS.LEDGER_READ)
  @ResponseMessage('Receipt')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.payments.receipt(id);
  }

  /** Needs a reason; the receipt stays, marked cancelled. */
  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.FEES_CANCEL_RECEIPT)
  @ResponseMessage('Receipt cancelled')
  cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelDto) {
    return this.payments.cancelReceipt(id, dto.reason);
  }

  /** Thermal (80 mm) or A4 PDF; poll `GET /jobs/:id`. */
  @Post(':id/pdf')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions(PERMISSIONS.FEES_COLLECT, PERMISSIONS.LEDGER_READ)
  @ResponseMessage('Receipt PDF started')
  pdf(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReceiptPdfDto) {
    return this.payments.startReceiptPdf(id, dto.paper ?? '80mm');
  }
}
