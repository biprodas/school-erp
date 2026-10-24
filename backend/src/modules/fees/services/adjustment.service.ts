import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { Paginated } from '~/common/dto/paginated.dto';
import { RequestContext } from '~/shared/request-context/request-context.service';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';
import { AuditService } from '~/modules/audit/services/audit.service';
import { SettingsService } from '~/modules/settings/services/settings.service';
import { lineOutstanding } from '../domain/fee-math';
import { DecisionDto } from '../dto/fee-setup.dto';
import { FilterAdjustmentDto, RequestAdjustmentDto } from '../dto/payment.dto';
import type { Adjustment } from '../entities/adjustment.entity';
import type { InvoiceLine } from '../entities/invoice.entity';
import {
  AdjustmentType,
  ApprovalStatus,
  LedgerAccount,
  LedgerDirection,
} from '../enums/fee.enum';
import {
  AdjustmentRepository,
  InvoiceLineRepository,
} from '../repositories/fee.repositories';
import { InvoiceTotalsService } from './invoice-totals.service';
import { LedgerService } from './ledger.service';

/**
 * Refunds, waivers and corrections (PRD 6.10): requested on an invoice
 * line, applied only when approved with `fees:approve_waiver`.
 * - waiver: the line owes less (at most what it still owes);
 * - correction: signed; positive owes less, negative owes more;
 * - refund: collected money goes back for an overcharge, so the line both
 *   owes and was paid less (its balance stays) and the ledger records the
 *   payout.
 */
@Injectable()
export class AdjustmentService {
  constructor(
    private readonly adjustmentRepo: AdjustmentRepository,
    private readonly lineRepo: InvoiceLineRepository,
    private readonly totals: InvoiceTotalsService,
    private readonly ledger: LedgerService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly context: RequestContext,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  findFiltered(filter: FilterAdjustmentDto): Promise<Paginated<Adjustment>> {
    const where: FindOptionsWhere<Adjustment> = {};
    if (filter.status) where.status = filter.status;
    if (filter.invoiceId) where.invoiceId = filter.invoiceId;
    return this.adjustmentRepo.findPage(
      { where, relations: { invoiceLine: true }, order: { createdAt: 'DESC' } },
      filter,
    );
  }

  async request(dto: RequestAdjustmentDto): Promise<Adjustment> {
    const line = await this.lineRepo.findByIdOrFail(dto.invoiceLineId);
    assertAllowed(dto.type, dto.amount, line);
    return this.adjustmentRepo.saveNew({
      type: dto.type,
      invoiceLineId: line.id,
      invoiceId: line.invoiceId,
      amount: dto.amount,
      paidFrom:
        dto.type === AdjustmentType.REFUND
          ? (dto.paidFrom ?? LedgerAccount.CASH)
          : null,
      reason: dto.reason,
      status: ApprovalStatus.PENDING,
      requestedBy: this.context.current().userId,
      decidedBy: null,
      decidedAt: null,
      decisionNote: null,
    });
  }

  approve(id: string, dto: DecisionDto): Promise<Adjustment> {
    return this.ds.runInTransaction(async () => {
      const adjustment = await this.pending(id);
      const line = (await this.lineRepo.findOne({
        where: { id: adjustment.invoiceLineId },
        lock: { mode: 'pessimistic_write' },
      }))!;
      // Balances may have moved since the request.
      assertAllowed(adjustment.type, adjustment.amount, line);
      const refund = adjustment.type === AdjustmentType.REFUND;
      await this.lineRepo.updateById(line.id, {
        adjusted: line.adjusted + adjustment.amount,
        refunded: refund ? line.refunded + adjustment.amount : undefined,
      });
      await this.totals.refresh([line.invoiceId]);
      if (refund) {
        await this.ledger.record({
          date: await this.settings.today(),
          direction: LedgerDirection.EXPENSE,
          account: adjustment.paidFrom ?? LedgerAccount.CASH,
          amount: adjustment.amount,
          sourceType: 'refund',
          sourceId: adjustment.id,
          description: `Refund: ${line.description} (${line.period})`,
        });
      }
      return this.decide(adjustment, ApprovalStatus.APPROVED, dto);
    });
  }

  reject(id: string, dto: DecisionDto): Promise<Adjustment> {
    return this.ds.runInTransaction(async () =>
      this.decide(await this.pending(id), ApprovalStatus.REJECTED, dto),
    );
  }

  private async decide(
    adjustment: Adjustment,
    status: ApprovalStatus,
    dto: DecisionDto,
  ): Promise<Adjustment> {
    await this.adjustmentRepo.updateById(adjustment.id, {
      status,
      decidedBy: this.context.current().userId,
      decidedAt: new Date(),
      decisionNote: dto.note ?? null,
    });
    await this.audit.record({
      action: AUDIT_ACTIONS.FEE_ADJUSTMENT_DECIDED,
      entityType: 'adjustment',
      entityId: adjustment.id,
      before: { status: adjustment.status },
      after: {
        status,
        type: adjustment.type,
        amount: adjustment.amount,
        invoiceLineId: adjustment.invoiceLineId,
      },
    });
    return this.adjustmentRepo.findByIdOrFail(adjustment.id);
  }

  private async pending(id: string): Promise<Adjustment> {
    const adjustment = await this.adjustmentRepo.findByIdOrFail(id);
    if (adjustment.status !== ApprovalStatus.PENDING) {
      throw new ConflictException({
        message: `The adjustment is ${adjustment.status}`,
        code: 'NOT_PENDING',
      });
    }
    return adjustment;
  }
}

function assertAllowed(
  type: AdjustmentType,
  amount: number,
  line: InvoiceLine,
) {
  const bad = (message: string) =>
    new BadRequestException({ message, code: 'INVALID_ADJUSTMENT' });
  if (line.cancelled) throw bad('The line is on a cancelled invoice');
  const owes = lineOutstanding(line);
  switch (type) {
    case AdjustmentType.WAIVER:
      if (amount <= 0 || amount > owes) throw bad(`A waiver is 1 to ${owes}`);
      return;
    case AdjustmentType.CORRECTION:
      if (amount === 0 || amount > owes)
        throw bad(`A correction lowers at most ${owes}`);
      return;
    case AdjustmentType.REFUND: {
      const room = Math.min(
        line.allocated - line.refunded,
        line.net - line.adjusted,
      );
      if (amount <= 0 || amount > room)
        throw bad(`A refund is 1 to ${Math.max(room, 0)}`);
      return;
    }
  }
}
