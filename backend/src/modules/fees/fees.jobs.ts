import { Injectable } from '@nestjs/common';
import { JobHandler, QUEUES } from '~/shared/queue';
import type { JobContext, JobPayload } from '~/shared/queue';
import { PdfService } from '~/shared/pdf/pdf.service';
import { FileService } from '~/modules/files/file.service';
import { JobTracker } from '~/modules/jobs/services/job-tracker.service';
import { SettingsService } from '~/modules/settings/services/settings.service';
import { ReceiptStatus } from './enums/fee.enum';
import {
  BILLING_JOB,
  BillingService,
  type BillingJobData,
} from './services/billing.service';
import { PaymentService, RECEIPT_PDF_JOB } from './services/payment.service';

/** Minor units as `1,234.50`. */
export const formatMoney = (minor: number) =>
  (minor / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const RECEIPT_CSS = {
  '80mm': `body{font-size:9pt}.receipt{padding:3mm}
    .head{text-align:center}.school{font-weight:bold;font-size:11pt}
    .title{margin:1mm 0 2mm;font-weight:bold}
    td{padding:.6mm 0;vertical-align:top}.lines{margin-top:2mm;border-top:1px dashed #000}
    .lines th,.lines td{text-align:right}.lines .l{text-align:left}
    tfoot td{border-top:1px dashed #000}
    .stamp{text-align:center;font-weight:bold;color:#b00;border:2px solid #b00;margin:2mm 0}
    .sign{margin-top:10mm;text-align:center}.line{border-top:1px solid #000;margin:0 10mm 1mm}`,
  A4: `body{font-size:11pt}.receipt{max-width:150mm;margin:0 auto}
    .head{text-align:center;margin-bottom:5mm}.school{font-weight:bold;font-size:16pt}
    .title{font-size:13pt;font-weight:bold;margin-top:2mm}
    .meta td{padding:1mm 3mm 1mm 0}
    .lines{margin-top:5mm}.lines th,.lines td{border:1px solid #666;padding:2mm;text-align:right}
    .lines .l{text-align:left}
    .stamp{text-align:center;font-size:20pt;font-weight:bold;color:#b00;border:3px solid #b00;margin:4mm 0}
    .sign{margin-top:20mm;text-align:right}.line{border-top:1px solid #000;width:50mm;margin:0 0 1mm auto}`,
};

/** Fee work on the queues: invoice generation and receipt PDFs. */
@Injectable()
export class FeeJobs {
  constructor(
    private readonly tracker: JobTracker,
    private readonly pdf: PdfService,
  ) {}

  @JobHandler(QUEUES.billing, BILLING_JOB)
  generate(payload: JobPayload<BillingJobData>, context: JobContext) {
    return this.tracker.run(payload, context, async (scope) => {
      const billing = await scope.resolve(BillingService);
      const summary = await billing.generate(payload.data, (p) =>
        scope.progress(p),
      );
      return { result: { ...summary } };
    });
  }

  @JobHandler(QUEUES.pdf, RECEIPT_PDF_JOB)
  receipt(
    payload: JobPayload<{ receiptId: string; paper: '80mm' | 'A4' }>,
    context: JobContext,
  ) {
    return this.tracker.run(payload, context, async ({ resolve }) => {
      const payments = await resolve(PaymentService);
      const settings = await resolve(SettingsService);
      const files = await resolve(FileService);
      const r = await payments.receipt(payload.data.receiptId);
      const school = await settings.getDisplay();
      const payment = r.payment!;
      const lines = r.allocations.map((a) => ({
        student: a.studentName,
        description: a.description,
        period: a.period,
        amount: formatMoney(a.amount),
      }));
      const buffer = await this.pdf.render(
        'fees/receipt',
        {
          schoolName: school.name,
          schoolNameBn: school.nameBn,
          number: r.number,
          issuedOn: r.issuedAt.toISOString().slice(0, 10),
          payer: payment.payerGuardian?.name ?? payment.student?.fullName ?? '',
          channel: payment.channel,
          reference: payment.reference,
          currency: school.locale.currency,
          total: formatMoney(payment.amount),
          lines,
          cancelled: r.status === ReceiptStatus.CANCELLED,
          cancelReason: r.cancelReason,
        },
        { paper: payload.data.paper, css: RECEIPT_CSS[payload.data.paper] },
      );
      const stored = await files.storeGenerated({
        buffer,
        originalName: `receipt-${r.number}.pdf`,
      });
      return { fileId: stored.id };
    });
  }
}
