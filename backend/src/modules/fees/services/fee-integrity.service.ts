import { Inject, Injectable, Logger } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import {
  InvoiceLineRepository,
  InvoiceRepository,
} from '../repositories/fee.repositories';
import { InvoiceTotalsService } from './invoice-totals.service';

export interface IntegrityResult {
  linesFixed: number;
  invoicesFixed: number;
}

/**
 * The nightly check of PRD 6.10's invariants: recomputes each line's
 * allocated, adjusted and refunded amounts from live allocations and
 * approved adjustments, then the invoices' cached totals. Any drift is
 * logged as an error (it means a write skipped the allocation
 * transaction) and corrected.
 */
@Injectable()
export class FeeIntegrityService {
  private readonly logger = new Logger(FeeIntegrityService.name);

  constructor(
    private readonly lineRepo: InvoiceLineRepository,
    private readonly invoiceRepo: InvoiceRepository,
    private readonly totals: InvoiceTotalsService,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  check(): Promise<IntegrityResult> {
    return this.ds.runInTransaction(async () => {
      const org = this.lineRepo.org;
      // An UPDATE … RETURNING comes back as [rows, affected].
      const [drifted] = await this.lineRepo.sql<
        [{ id: string; invoice_id: string }[], number]
      >(
        `WITH expected AS (
           SELECT l."id", l."invoice_id",
             coalesce((SELECT sum(a."amount") FROM "payment_allocations" a
                       WHERE a."invoice_line_id" = l."id" AND a."reversed_at" IS NULL), 0) AS allocated,
             coalesce((SELECT sum(j."amount") FROM "adjustments" j
                       WHERE j."invoice_line_id" = l."id" AND j."status" = 'approved'), 0) AS adjusted,
             coalesce((SELECT sum(j."amount") FROM "adjustments" j
                       WHERE j."invoice_line_id" = l."id" AND j."status" = 'approved'
                         AND j."type" = 'refund'), 0) AS refunded
           FROM "invoice_lines" l WHERE l."org_id" = $1
         )
         UPDATE "invoice_lines" l
         SET "allocated" = e.allocated, "adjusted" = e.adjusted, "refunded" = e.refunded
         FROM expected e
         WHERE l."id" = e."id" AND l."org_id" = $1
           AND (l."allocated" <> e.allocated OR l."adjusted" <> e.adjusted OR l."refunded" <> e.refunded)
         RETURNING l."id", l."invoice_id"`,
        [org],
      );
      const before = await this.invoiceRepo.sql<{ id: string; sig: string }[]>(
        `SELECT "id", concat_ws(':', "total", "discount_total", "fine_total", "net_total",
                "adjusted_total", "allocated_total", "refunded_total", "status") AS sig
         FROM "invoices" WHERE "org_id" = $1`,
        [org],
      );
      await this.totals.refresh(before.map((r) => r.id));
      const after = new Map(
        (
          await this.invoiceRepo.sql<{ id: string; sig: string }[]>(
            `SELECT "id", concat_ws(':', "total", "discount_total", "fine_total", "net_total",
                    "adjusted_total", "allocated_total", "refunded_total", "status") AS sig
             FROM "invoices" WHERE "org_id" = $1`,
            [org],
          )
        ).map((r) => [r.id, r.sig]),
      );
      const invoicesFixed = before.filter(
        (r) => after.get(r.id) !== r.sig,
      ).length;
      const result = { linesFixed: drifted.length, invoicesFixed };
      if (result.linesFixed || result.invoicesFixed) {
        this.logger.error(
          `Fee totals drifted and were corrected: ${JSON.stringify(result)}`,
        );
      }
      return result;
    });
  }
}
