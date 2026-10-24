import { Injectable } from '@nestjs/common';
import { InvoiceStatus } from '../enums/fee.enum';
import { InvoiceRepository } from '../repositories/fee.repositories';

interface Sums {
  invoice_id: string;
  total: string;
  discount: string;
  fine: string;
  net: string;
  adjusted: string;
  allocated: string;
  refunded: string;
}

/**
 * Keeps an invoice's cached totals and status equal to its lines. Called
 * inside every transaction that changes lines (billing, fines, payments,
 * reversals, adjustments), after those changes.
 */
@Injectable()
export class InvoiceTotalsService {
  constructor(private readonly invoiceRepo: InvoiceRepository) {}

  async refresh(invoiceIds: string[]): Promise<void> {
    const ids = [...new Set(invoiceIds)];
    if (!ids.length) return;
    const rows = await this.invoiceRepo.sql<Sums[]>(
      `SELECT "invoice_id",
              coalesce(sum("amount"), 0) AS total,
              coalesce(sum("discount"), 0) AS discount,
              coalesce(sum("amount") FILTER (WHERE "kind" = 'fine'), 0) AS fine,
              coalesce(sum("net"), 0) AS net,
              coalesce(sum("adjusted"), 0) AS adjusted,
              coalesce(sum("allocated"), 0) AS allocated,
              coalesce(sum("refunded"), 0) AS refunded
       FROM "invoice_lines"
       WHERE "org_id" = $1 AND "invoice_id" = ANY($2::uuid[]) AND NOT "cancelled"
       GROUP BY "invoice_id"`,
      [this.invoiceRepo.org, ids],
    );
    const invoices = await this.invoiceRepo.findByIds(ids);
    for (const invoice of invoices) {
      const r = rows.find((x) => x.invoice_id === invoice.id);
      const n = (v: string | undefined) => Number(v ?? 0);
      const totals = {
        total: n(r?.total),
        discountTotal: n(r?.discount),
        fineTotal: n(r?.fine),
        netTotal: n(r?.net),
        adjustedTotal: n(r?.adjusted),
        allocatedTotal: n(r?.allocated),
        refundedTotal: n(r?.refunded),
      };
      await this.invoiceRepo.updateById(invoice.id, {
        ...totals,
        status:
          invoice.status === InvoiceStatus.CANCELLED
            ? InvoiceStatus.CANCELLED
            : statusOf(totals),
      });
    }
  }
}

/** Paid once nothing is outstanding, partly paid once anything is collected. */
export function statusOf(t: {
  netTotal: number;
  adjustedTotal: number;
  allocatedTotal: number;
  refundedTotal: number;
}): InvoiceStatus {
  const outstanding =
    t.netTotal - t.adjustedTotal - t.allocatedTotal + t.refundedTotal;
  if (outstanding <= 0) return InvoiceStatus.PAID;
  if (t.allocatedTotal - t.refundedTotal > 0)
    return InvoiceStatus.PARTIALLY_PAID;
  return InvoiceStatus.OPEN;
}

/** An invoice's outstanding from its cached totals. */
export const invoiceOutstanding = (t: {
  netTotal: number;
  adjustedTotal: number;
  allocatedTotal: number;
  refundedTotal: number;
}) => t.netTotal - t.adjustedTotal - t.allocatedTotal + t.refundedTotal;
