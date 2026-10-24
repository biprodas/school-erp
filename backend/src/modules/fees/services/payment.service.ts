import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Between, FindOptionsWhere, In, IsNull } from 'typeorm';
import { Paginated } from '~/common/dto/paginated.dto';
import { QUEUES } from '~/shared/queue';
import { RequestContext } from '~/shared/request-context/request-context.service';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';
import { AuditService } from '~/modules/audit/services/audit.service';
import { DOMAIN_EVENTS } from '~/modules/domain-events/domain-events';
import { DomainEventService } from '~/modules/domain-events/domain-event.service';
import { GuardianService } from '~/modules/guardians/services/guardian.service';
import type { Job } from '~/modules/jobs/entities/job.entity';
import { JobService } from '~/modules/jobs/services/job.service';
import { NumberingService } from '~/modules/numbering/numbering.service';
import { patternScope } from '~/modules/numbering/numbering-pattern';
import { SettingsService } from '~/modules/settings/services/settings.service';
import { StudentService } from '~/modules/students/services/student.service';
import { allocate, AllocationError, lineOutstanding } from '../domain/fee-math';
import { CreatePaymentDto, FilterPaymentDto } from '../dto/payment.dto';
import type { InvoiceLine } from '../entities/invoice.entity';
import type { Payment, Receipt } from '../entities/payment.entity';
import {
  InvoiceStatus,
  LedgerDirection,
  PaymentStatus,
  ReceiptStatus,
} from '../enums/fee.enum';
import {
  InvoiceLineRepository,
  PaymentAllocationRepository,
  PaymentRepository,
  PaymentReversalRepository,
  ReceiptRepository,
} from '../repositories/fee.repositories';
import { InvoiceTotalsService } from './invoice-totals.service';
import { accountFor, LedgerService } from './ledger.service';

export const RECEIPT_PDF_JOB = 'fee-receipt';

/**
 * Counter collection (PRD 6.10, workflow 7.3 step 5). A payment is
 * allocated to invoice lines in the same transaction that row-locks them,
 * gets a gap-free receipt number from `NumberingService` and writes its
 * ledger entry. Payments are never edited or deleted: cancelling the
 * receipt reverses the payment and releases its allocations, and both
 * stay visible.
 */
@Injectable()
export class PaymentService {
  constructor(
    private readonly paymentRepo: PaymentRepository,
    private readonly allocationRepo: PaymentAllocationRepository,
    private readonly receiptRepo: ReceiptRepository,
    private readonly reversalRepo: PaymentReversalRepository,
    private readonly lineRepo: InvoiceLineRepository,
    private readonly totals: InvoiceTotalsService,
    private readonly ledger: LedgerService,
    private readonly students: StudentService,
    private readonly guardians: GuardianService,
    private readonly numbering: NumberingService,
    private readonly settings: SettingsService,
    private readonly jobs: JobService,
    private readonly events: DomainEventService,
    private readonly audit: AuditService,
    private readonly context: RequestContext,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  /** Records a payment, allocates it and issues the receipt. */
  collect(dto: CreatePaymentDto) {
    return this.ds.runInTransaction(async () => {
      if (!!dto.studentId === !!dto.guardianId) {
        throw new BadRequestException({
          message: 'Give a student or a guardian',
          code: 'PAYER_REQUIRED',
        });
      }
      const studentIds = dto.studentId
        ? [(await this.students.findById(dto.studentId)).id]
        : await this.guardians.childIds(dto.guardianId!);
      const lines = await this.lockOpenLines(studentIds);
      const dueDate = await this.dueDates(lines);
      let parts: { lineId: string; amount: number }[];
      try {
        parts = allocate(
          dto.amount,
          lines.map((l, i) => ({
            id: l.id,
            outstanding: lineOutstanding(l),
            dueDate: dueDate.get(l.invoiceId)!,
            order: i,
          })),
          dto.allocations?.map((a) => ({
            lineId: a.invoiceLineId,
            amount: a.amount,
          })),
        );
      } catch (err) {
        if (err instanceof AllocationError) {
          throw new BadRequestException({
            message: err.message,
            code: err.code,
            ...(err.lineId && { invoiceLineId: err.lineId }),
          });
        }
        throw err;
      }

      const userId = this.context.current().userId;
      const now = new Date();
      const today = await this.settings.today();
      const payment = await this.paymentRepo.saveNew({
        studentId: dto.studentId ?? null,
        payerGuardianId: dto.guardianId ?? null,
        channel: dto.channel,
        amount: dto.amount,
        reference: dto.reference ?? null,
        receivedBy: userId,
        receivedAt: now,
        receivedOn: today,
        status: PaymentStatus.COMPLETED,
      });
      const byId = new Map(lines.map((l) => [l.id, l]));
      await this.allocationRepo.insertMany(
        parts.map((p) => ({
          paymentId: payment.id,
          invoiceLineId: p.lineId,
          invoiceId: byId.get(p.lineId)!.invoiceId,
          amount: p.amount,
          reversedAt: null,
        })),
      );
      for (const p of parts) {
        const line = byId.get(p.lineId)!;
        await this.lineRepo.updateById(line.id, {
          allocated: line.allocated + p.amount,
        });
      }
      await this.totals.refresh(
        parts.map((p) => byId.get(p.lineId)!.invoiceId),
      );

      // Gap-free: the counter row stays locked until this commits.
      const { receipt: pattern } = await this.settings.getSection('numbering');
      const receipt = await this.receiptRepo.saveNew({
        number: await this.numbering.nextFormatted(
          'receipt',
          pattern,
          patternScope(pattern),
        ),
        paymentId: payment.id,
        issuedAt: now,
        issuedBy: userId,
        status: ReceiptStatus.VALID,
        cancelReason: null,
        cancelledBy: null,
        cancelledAt: null,
      });
      await this.ledger.record({
        date: today,
        direction: LedgerDirection.INCOME,
        account: accountFor(dto.channel),
        amount: dto.amount,
        sourceType: 'payment',
        sourceId: payment.id,
        description: `Receipt ${receipt.number}`,
      });
      await this.audit.record({
        action: AUDIT_ACTIONS.FEE_PAYMENT_RECORDED,
        entityType: 'payment',
        entityId: payment.id,
        after: {
          receipt: receipt.number,
          amount: dto.amount,
          channel: dto.channel,
          allocations: parts,
        },
      });
      await this.events.record(DOMAIN_EVENTS.PAYMENT_RECEIVED, {
        paymentId: payment.id,
        receiptId: receipt.id,
        receiptNumber: receipt.number,
        studentIds,
        guardianId: dto.guardianId ?? null,
        amount: dto.amount,
      });
      return this.receipt(receipt.id);
    });
  }

  /** Cancels a receipt: reverses its payment and releases the allocations. */
  cancelReceipt(id: string, reason: string) {
    return this.ds.runInTransaction(async () => {
      const receipt = await this.receiptRepo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!receipt) throw new NotFoundException(`Receipt "${id}" not found`);
      if (receipt.status !== ReceiptStatus.VALID) {
        throw new ConflictException({
          message: 'The receipt is already cancelled',
          code: 'RECEIPT_CANCELLED',
        });
      }
      const payment = await this.paymentRepo.findByIdOrFail(receipt.paymentId);
      const allocations = await this.allocationRepo.find({
        where: { paymentId: payment.id, reversedAt: IsNull() },
      });
      const lines = allocations.length
        ? await this.lineRepo.find({
            where: allocations.map((a) => ({ id: a.invoiceLineId })),
            lock: { mode: 'pessimistic_write' },
            order: { id: 'ASC' },
          })
        : [];
      const byId = new Map(lines.map((l) => [l.id, l]));
      for (const a of allocations) {
        const line = byId.get(a.invoiceLineId)!;
        if (line.allocated - line.refunded < a.amount) {
          throw new ConflictException({
            message:
              'Part of this payment was refunded; it can no longer be reversed',
            code: 'PAYMENT_REFUNDED',
          });
        }
      }
      const now = new Date();
      const userId = this.context.current().userId;
      for (const a of allocations) {
        const line = byId.get(a.invoiceLineId)!;
        line.allocated -= a.amount;
        await this.lineRepo.updateById(line.id, { allocated: line.allocated });
        await this.allocationRepo.updateById(a.id, { reversedAt: now });
      }
      await this.totals.refresh(allocations.map((a) => a.invoiceId));
      await this.paymentRepo.updateById(payment.id, {
        status: PaymentStatus.REVERSED,
      });
      await this.receiptRepo.updateById(id, {
        status: ReceiptStatus.CANCELLED,
        cancelReason: reason,
        cancelledBy: userId,
        cancelledAt: now,
      });
      await this.reversalRepo.saveNew({
        paymentId: payment.id,
        receiptId: id,
        amount: payment.amount,
        reason,
        reversedBy: userId,
      });
      await this.ledger.record({
        date: await this.settings.today(),
        direction: LedgerDirection.EXPENSE,
        account: accountFor(payment.channel),
        amount: payment.amount,
        sourceType: 'payment_reversal',
        sourceId: payment.id,
        description: `Receipt ${receipt.number} cancelled`,
      });
      await this.audit.record({
        action: AUDIT_ACTIONS.RECEIPT_CANCELLED,
        entityType: 'receipt',
        entityId: id,
        before: { status: ReceiptStatus.VALID, amount: payment.amount },
        after: { status: ReceiptStatus.CANCELLED, reason },
      });
      return this.receipt(id);
    });
  }

  findPayments(filter: FilterPaymentDto): Promise<Paginated<Payment>> {
    const where: FindOptionsWhere<Payment> = {};
    if (filter.studentId) where.studentId = filter.studentId;
    if (filter.receivedBy) where.receivedBy = filter.receivedBy;
    if (filter.status) where.status = filter.status;
    if (filter.from || filter.to) {
      where.receivedOn = Between(
        filter.from ?? '0001-01-01',
        filter.to ?? '9999-12-31',
      );
    }
    return this.paymentRepo.findPage(
      {
        where,
        relations: { student: true, payerGuardian: true },
        order: { receivedAt: 'DESC' },
      },
      filter,
    );
  }

  /**
   * Payments that settled any invoice of these students (the portal's
   * payment history), newest first, with their receipts.
   */
  async paymentsForStudents(studentIds: string[]) {
    if (!studentIds.length) return [];
    const rows = await this.paymentRepo.sql<{ payment_id: string }[]>(
      `SELECT DISTINCT a."payment_id" FROM "payment_allocations" a
       JOIN "invoices" i ON i."id" = a."invoice_id"
       WHERE a."org_id" = $1 AND i."student_id" = ANY($2::uuid[])`,
      [this.paymentRepo.org, studentIds],
    );
    const payments = (
      await this.paymentRepo.findByIds(rows.map((r) => r.payment_id))
    ).sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
    const receipts = await this.receiptRepo.find({
      where: payments.length
        ? { paymentId: In(payments.map((p) => p.id)) }
        : { id: In([]) },
    });
    return payments.map((p) => {
      const r = receipts.find((x) => x.paymentId === p.id);
      return {
        id: p.id,
        amount: p.amount,
        channel: p.channel,
        status: p.status,
        receivedAt: p.receivedAt,
        receiptId: r?.id ?? null,
        receiptNumber: r?.number ?? null,
        receiptStatus: r?.status ?? null,
      };
    });
  }

  /** Whether a receipt settled anything of these students. */
  async receiptCovers(
    receiptId: string,
    studentIds: string[],
  ): Promise<boolean> {
    const receipt = await this.receiptRepo.findById(receiptId);
    if (!receipt) return false;
    const covered = await this.allocationRepo.find({
      where: { paymentId: receipt.paymentId },
      relations: { invoice: true },
    });
    return covered.some((a) => studentIds.includes(a.invoice!.studentId));
  }

  /** A receipt with its payment and what the payment settled. */
  async receipt(id: string) {
    const receipt = await this.receiptRepo.findOne({
      where: { id },
      relations: { payment: { student: true, payerGuardian: true } },
    });
    if (!receipt) throw new NotFoundException(`Receipt "${id}" not found`);
    return this.receiptView(receipt);
  }

  async receiptForPayment(paymentId: string) {
    const receipt = await this.receiptRepo.findOne({ where: { paymentId } });
    if (!receipt) throw new NotFoundException('Receipt not found');
    return this.receipt(receipt.id);
  }

  async startReceiptPdf(id: string, paper: '80mm' | 'A4'): Promise<Job> {
    await this.receipt(id);
    return this.jobs.start<{ receiptId: string; paper: '80mm' | 'A4' }>({
      type: 'fees.receipt_pdf',
      queue: QUEUES.pdf,
      name: RECEIPT_PDF_JOB,
      data: { receiptId: id, paper },
    });
  }

  private async receiptView(receipt: Receipt) {
    const allocations = await this.allocationRepo.find({
      where: { paymentId: receipt.paymentId },
      relations: { invoiceLine: true, invoice: { student: true } },
      order: { createdAt: 'ASC' },
    });
    return {
      ...receipt,
      allocations: allocations.map((a) => ({
        id: a.id,
        amount: a.amount,
        reversedAt: a.reversedAt,
        invoiceId: a.invoiceId,
        invoiceNumber: a.invoice?.number ?? '',
        studentId: a.invoice?.studentId ?? '',
        studentName: a.invoice?.student?.fullName ?? '',
        admissionNumber: a.invoice?.student?.admissionNumber ?? '',
        invoiceLineId: a.invoiceLineId,
        description: a.invoiceLine?.description ?? '',
        period: a.invoiceLine?.period ?? '',
      })),
    };
  }

  /**
   * The students' lines on open invoices, row-locked (in id order, so
   * concurrent collections can't deadlock) until the transaction ends.
   */
  private lockOpenLines(studentIds: string[]): Promise<InvoiceLine[]> {
    if (!studentIds.length) return Promise.resolve([]);
    return this.lineRepo
      .qb('l')
      .innerJoin('l.invoice', 'i')
      .andWhere('l.studentId IN (:...studentIds)', { studentIds })
      .andWhere('l.cancelled = false')
      .andWhere('i.status IN (:...statuses)', {
        statuses: [
          InvoiceStatus.OPEN,
          InvoiceStatus.PARTIALLY_PAID,
          InvoiceStatus.PAID,
        ],
      })
      .orderBy('l.id', 'ASC')
      .setLock('pessimistic_write')
      .getMany();
  }

  private async dueDates(lines: InvoiceLine[]): Promise<Map<string, string>> {
    const ids = [...new Set(lines.map((l) => l.invoiceId))];
    const rows = await this.lineRepo.sql<{ id: string; due_date: string }[]>(
      `SELECT "id", to_char("due_date", 'YYYY-MM-DD') AS due_date FROM "invoices"
       WHERE "org_id" = $1 AND "id" = ANY($2::uuid[])`,
      [this.lineRepo.org, ids],
    );
    return new Map(rows.map((r) => [r.id, r.due_date]));
  }
}
