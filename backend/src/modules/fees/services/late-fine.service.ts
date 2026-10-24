import { Inject, Injectable } from '@nestjs/common';
import { In, LessThan } from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { SettingsService } from '~/modules/settings/services/settings.service';
import { fineFor, lineOutstanding } from '../domain/fee-math';
import { InvoiceLineKind, InvoiceStatus } from '../enums/fee.enum';
import {
  InvoiceLineRepository,
  InvoiceRepository,
} from '../repositories/fee.repositories';
import { FeeSetupService } from './fee-setup.service';
import { InvoiceTotalsService } from './invoice-totals.service';

/**
 * Late fines (PRD 6.10): run daily. An overdue invoice whose fee lines are
 * still unpaid gets one fine line per rule that applies (a rule without a
 * head applies to every invoice); a per-day fine grows to today's amount
 * and stops growing once the fees are paid. Idempotent.
 */
@Injectable()
export class LateFineService {
  constructor(
    private readonly invoiceRepo: InvoiceRepository,
    private readonly lineRepo: InvoiceLineRepository,
    private readonly setup: FeeSetupService,
    private readonly totals: InvoiceTotalsService,
    private readonly settings: SettingsService,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  /** Returns how many fine lines were added or raised. */
  async apply(today?: string): Promise<number> {
    const day = today ?? (await this.settings.today());
    const rules = await this.setup.activeFineRules();
    if (!rules.length) return 0;
    const { graceDays } = await this.settings.getSection('fees');
    const overdue = await this.invoiceRepo.find({
      where: {
        status: In([InvoiceStatus.OPEN, InvoiceStatus.PARTIALLY_PAID]),
        dueDate: LessThan(day),
      },
      select: { id: true, dueDate: true, period: true, studentId: true },
    });
    let changed = 0;
    for (const invoice of overdue) {
      changed += await this.ds.runInTransaction(async () => {
        const lines = await this.lineRepo.find({
          where: { invoiceId: invoice.id, cancelled: false },
          lock: { mode: 'pessimistic_write' },
        });
        const fees = lines.filter((l) => l.kind !== InvoiceLineKind.FINE);
        if (fees.every((l) => lineOutstanding(l) <= 0)) return 0;
        let touched = 0;
        for (const rule of rules) {
          if (
            rule.feeHeadId &&
            !fees.some((l) => l.feeHeadId === rule.feeHeadId)
          )
            continue;
          const amount = fineFor(
            {
              kind: rule.kind,
              amount: rule.amount,
              graceDays: rule.graceDays ?? graceDays,
              maxAmount: rule.maxAmount,
            },
            invoice.dueDate,
            day,
          );
          if (amount <= 0) continue;
          const existing = lines.find(
            (l) =>
              l.kind === InvoiceLineKind.FINE && l.lateFineRuleId === rule.id,
          );
          if (existing) {
            if (amount <= existing.amount) continue;
            await this.lineRepo.updateById(existing.id, {
              amount,
              net: amount - existing.discount,
            });
          } else {
            await this.lineRepo.insertMany([
              {
                invoiceId: invoice.id,
                studentId: invoice.studentId,
                kind: InvoiceLineKind.FINE,
                feeHeadId: rule.feeHeadId,
                lateFineRuleId: rule.id,
                period: invoice.period,
                description: `Late fine: ${rule.name}`,
                amount,
                discount: 0,
                discounts: [],
                net: amount,
              },
            ]);
          }
          touched++;
        }
        if (touched) await this.totals.refresh([invoice.id]);
        return touched;
      });
    }
    return changed;
  }
}
