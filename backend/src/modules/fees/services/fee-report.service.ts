import { ForbiddenException, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { DOMAIN_EVENTS } from '~/modules/domain-events/domain-events';
import { DomainEventService } from '~/modules/domain-events/domain-event.service';
import { SettingsService } from '~/modules/settings/services/settings.service';
import { agingBucket, daysBetween, type AgingBucket } from '../domain/fee-math';
import {
  DailyCollectionDto,
  DateRangeDto,
  DefaultersQueryDto,
  DuesQueryDto,
  PeriodRangeDto,
} from '../dto/report.dto';
import { InvoiceStatus, PaymentStatus, ReceiptStatus } from '../enums/fee.enum';
import {
  InvoiceRepository,
  PaymentRepository,
  ReceiptRepository,
} from '../repositories/fee.repositories';
import { invoiceOutstanding } from './invoice-totals.service';

const BUCKETS: AgingBucket[] = ['current', '0-30', '31-60', '61-90', '90+'];
const emptyBuckets = () =>
  Object.fromEntries(BUCKETS.map((b) => [b, 0])) as Record<AgingBucket, number>;

interface DueRow {
  student_id: string;
  enrollment_id: string;
  invoice_id: string;
  due_date: string;
  outstanding: string;
  full_name: string;
  admission_number: string;
  roll_no: string | null;
  section_id: string;
  section_name: string;
  class_id: string;
  class_name: string;
}

/**
 * Dues and fee reports (PRD 6.10): the due list with aging, defaulters,
 * collection vs. demand, head-wise collection, the discount report and
 * each collector's daily collection, plus due reminders and the
 * "has dues" check M7 uses to hold results back. `allowed` is the
 * caller's sections (null = every one); totals need school-wide access.
 */
@Injectable()
export class FeeReportService {
  constructor(
    private readonly invoiceRepo: InvoiceRepository,
    private readonly paymentRepo: PaymentRepository,
    private readonly receiptRepo: ReceiptRepository,
    private readonly settings: SettingsService,
    private readonly events: DomainEventService,
  ) {}

  /** Students who owe, with what they owe by age of the dues. */
  async dues(query: DuesQueryDto, allowed: string[] | null) {
    const asOf = query.asOf ?? (await this.settings.today());
    const rows = await this.dueRows(query, allowed);
    const byStudent = new Map<
      string,
      {
        studentId: string;
        admissionNumber: string;
        name: string;
        rollNo: string | null;
        classId: string;
        className: string;
        sectionId: string;
        sectionName: string;
        outstanding: number;
        overdue: number;
        oldestDueDate: string;
        buckets: Record<AgingBucket, number>;
      }
    >();
    const totals = emptyBuckets();
    for (const r of rows) {
      const amount = Number(r.outstanding);
      const bucket = agingBucket(daysBetween(r.due_date, asOf));
      const s = byStudent.get(r.student_id) ?? {
        studentId: r.student_id,
        admissionNumber: r.admission_number,
        name: r.full_name,
        rollNo: r.roll_no,
        classId: r.class_id,
        className: r.class_name,
        sectionId: r.section_id,
        sectionName: r.section_name,
        outstanding: 0,
        overdue: 0,
        oldestDueDate: r.due_date,
        buckets: emptyBuckets(),
      };
      s.outstanding += amount;
      if (bucket !== 'current') s.overdue += amount;
      if (r.due_date < s.oldestDueDate) s.oldestDueDate = r.due_date;
      s.buckets[bucket] += amount;
      totals[bucket] += amount;
      byStudent.set(r.student_id, s);
    }
    const students = [...byStudent.values()].sort(
      (a, b) =>
        a.className.localeCompare(b.className) ||
        a.sectionName.localeCompare(b.sectionName) ||
        b.outstanding - a.outstanding,
    );
    return {
      asOf,
      students,
      totals: {
        students: students.length,
        outstanding: students.reduce((n, s) => n + s.outstanding, 0),
        buckets: totals,
      },
    };
  }

  /** Students overdue at least `minDays` and `minAmount`. */
  async defaulters(query: DefaultersQueryDto, allowed: string[] | null) {
    const minDays = query.minDays ?? 1;
    const minAmount = query.minAmount ?? 1;
    const { asOf, students } = await this.dues(query, allowed);
    return {
      asOf,
      minDays,
      minAmount,
      students: students.filter(
        (s) =>
          s.overdue >= minAmount &&
          daysBetween(s.oldestDueDate, asOf) >= minDays,
      ),
    };
  }

  /**
   * Billed vs. collected per period: billed − discounts − adjustments −
   * (collected − refunded) = outstanding, line by line.
   */
  async collectionVsDemand(query: PeriodRangeDto, allowed: string[] | null) {
    assertSchoolWide(allowed);
    const rows = await this.invoiceRepo.sql<
      Record<
        | 'period'
        | 'billed'
        | 'discounts'
        | 'adjusted'
        | 'collected'
        | 'refunded',
        string
      >[]
    >(
      `SELECT l."period",
              sum(l."amount") AS billed, sum(l."discount") AS discounts,
              sum(l."adjusted") AS adjusted, sum(l."allocated") AS collected,
              sum(l."refunded") AS refunded
       FROM "invoice_lines" l
       JOIN "invoices" i ON i."id" = l."invoice_id"
       JOIN "student_enrollments" e ON e."id" = i."enrollment_id"
       WHERE l."org_id" = $1 AND NOT l."cancelled"
         AND l."period" BETWEEN $2 AND $3
         AND ($4::uuid IS NULL OR e."class_id" = $4)
       GROUP BY l."period" ORDER BY l."period"`,
      [this.invoiceRepo.org, query.from, query.to, query.classId ?? null],
    );
    const periods = rows.map((r) => {
      const n = (k: keyof typeof r) => Number(r[k]);
      const collected = n('collected') - n('refunded');
      return {
        period: r.period,
        billed: n('billed'),
        discounts: n('discounts'),
        adjusted: n('adjusted'),
        demand: n('billed') - n('discounts') - n('adjusted'),
        collected,
        outstanding: n('billed') - n('discounts') - n('adjusted') - collected,
      };
    });
    const sum = (k: keyof (typeof periods)[number]) =>
      periods.reduce((n, p) => n + (p[k] as number), 0);
    return {
      periods,
      totals: {
        billed: sum('billed'),
        discounts: sum('discounts'),
        adjusted: sum('adjusted'),
        demand: sum('demand'),
        collected: sum('collected'),
        outstanding: sum('outstanding'),
      },
    };
  }

  /** What payments received in a date range settled, by fee head. */
  async headWise(query: DateRangeDto, allowed: string[] | null) {
    assertSchoolWide(allowed);
    const rows = await this.invoiceRepo.sql<
      { head: string | null; kind: string; amount: string }[]
    >(
      `SELECT h."name" AS head, l."kind", sum(a."amount") AS amount
       FROM "payment_allocations" a
       JOIN "payments" p ON p."id" = a."payment_id"
       JOIN "invoice_lines" l ON l."id" = a."invoice_line_id"
       LEFT JOIN "fee_heads" h ON h."id" = l."fee_head_id"
       WHERE a."org_id" = $1 AND a."reversed_at" IS NULL
         AND p."received_on" BETWEEN $2 AND $3
       GROUP BY h."name", l."kind" ORDER BY amount DESC`,
      [this.invoiceRepo.org, query.from, query.to],
    );
    const heads = rows.map((r) => ({
      head: r.head ?? (r.kind === 'fine' ? 'Late fines' : 'Other'),
      kind: r.kind,
      amount: Number(r.amount),
    }));
    return { ...query, heads, total: heads.reduce((n, h) => n + h.amount, 0) };
  }

  /** Discounts given per type over billed periods. */
  async discounts(query: PeriodRangeDto, allowed: string[] | null) {
    assertSchoolWide(allowed);
    const rows = await this.invoiceRepo.sql<
      {
        discount_type_id: string;
        name: string | null;
        lines: number;
        amount: string;
      }[]
    >(
      `SELECT d."discountTypeId" AS discount_type_id, t."name",
              count(*)::int AS lines, sum((d."amount")::bigint) AS amount
       FROM "invoice_lines" l
       CROSS JOIN LATERAL jsonb_to_recordset(l."discounts")
         AS d("discountTypeId" uuid, "amount" bigint)
       LEFT JOIN "discount_types" t ON t."id" = d."discountTypeId"
       WHERE l."org_id" = $1 AND NOT l."cancelled" AND l."period" BETWEEN $2 AND $3
       GROUP BY d."discountTypeId", t."name" ORDER BY amount DESC`,
      [this.invoiceRepo.org, query.from, query.to],
    );
    const types = rows.map((r) => ({
      discountTypeId: r.discount_type_id,
      name: r.name ?? '',
      lines: r.lines,
      amount: Number(r.amount),
    }));
    return { ...query, types, total: types.reduce((n, t) => n + t.amount, 0) };
  }

  /**
   * Each collector's day: payments by channel and the receipts issued
   * (cancelled ones listed, not counted), so the cash in hand reconciles
   * to the receipts.
   */
  async dailyCollection(query: DailyCollectionDto, allowed: string[] | null) {
    assertSchoolWide(allowed);
    const date = query.date ?? (await this.settings.today());
    const payments = await this.paymentRepo.find({
      where: { receivedOn: date, receivedBy: query.receivedBy },
      relations: { student: true, payerGuardian: true },
      order: { receivedAt: 'ASC' },
    });
    const receipts = new Map(
      (
        await this.receiptRepo.find({
          where: payments.length
            ? { paymentId: In(payments.map((p) => p.id)) }
            : { id: In([]) },
        })
      ).map((r) => [r.paymentId, r]),
    );
    const collectors = new Map<
      string,
      {
        receivedBy: string | null;
        count: number;
        total: number;
        byChannel: Record<string, number>;
        cancelled: number;
        receipts: {
          number: string;
          status: ReceiptStatus;
          amount: number;
          channel: string;
          payer: string;
          receivedAt: Date;
        }[];
      }
    >();
    for (const p of payments) {
      const key = p.receivedBy ?? 'unknown';
      const c = collectors.get(key) ?? {
        receivedBy: p.receivedBy,
        count: 0,
        total: 0,
        byChannel: {},
        cancelled: 0,
        receipts: [],
      };
      const receipt = receipts.get(p.id);
      const live = p.status === PaymentStatus.COMPLETED;
      if (live) {
        c.count++;
        c.total += p.amount;
        c.byChannel[p.channel] = (c.byChannel[p.channel] ?? 0) + p.amount;
      } else {
        c.cancelled += p.amount;
      }
      c.receipts.push({
        number: receipt?.number ?? '',
        status: receipt?.status ?? ReceiptStatus.CANCELLED,
        amount: p.amount,
        channel: p.channel,
        payer: p.student?.fullName ?? p.payerGuardian?.name ?? '',
        receivedAt: p.receivedAt,
      });
      collectors.set(key, c);
    }
    const list = [...collectors.values()];
    return {
      date,
      collectors: list,
      total: list.reduce((n, c) => n + c.total, 0),
    };
  }

  /** Whether any of the students owes on an overdue invoice (M7 results hold). */
  async hasDues(studentIds: string[], asOf?: string): Promise<Set<string>> {
    if (!studentIds.length) return new Set();
    const day = asOf ?? (await this.settings.today());
    const open = await this.invoiceRepo.find({
      where: {
        studentId: In(studentIds),
        status: In([InvoiceStatus.OPEN, InvoiceStatus.PARTIALLY_PAID]),
      },
    });
    return new Set(
      open
        .filter((i) => i.dueDate < day && invoiceOutstanding(i) > 0)
        .map((i) => i.studentId),
    );
  }

  /**
   * Due reminders (PRD 6.10): one `fees.due_reminder` event per invoice and
   * offset in `fees.reminderDays`; M7 delivers them (email/in-app, SMS in
   * 1b). Returns how many were recorded.
   */
  async queueReminders(today?: string): Promise<number> {
    const day = today ?? (await this.settings.today());
    const { reminderDays } = await this.settings.getSection('fees');
    const offsets = [...reminderDays].sort((a, b) => a - b);
    if (!offsets.length) return 0;
    const open = await this.invoiceRepo.find({
      where: { status: In([InvoiceStatus.OPEN, InvoiceStatus.PARTIALLY_PAID]) },
    });
    let sent = 0;
    for (const invoice of open) {
      const offset = offsets[invoice.remindersSent];
      if (offset === undefined || daysBetween(invoice.dueDate, day) < offset)
        continue;
      if (invoiceOutstanding(invoice) <= 0) continue;
      await this.invoiceRepo.updateById(invoice.id, {
        remindersSent: invoice.remindersSent + 1,
      });
      await this.events.record(DOMAIN_EVENTS.FEES_DUE_REMINDER, {
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        studentId: invoice.studentId,
        dueDate: invoice.dueDate,
        outstanding: invoiceOutstanding(invoice),
        reminder: invoice.remindersSent + 1,
      });
      sent++;
    }
    return sent;
  }

  private dueRows(
    query: DuesQueryDto,
    allowed: string[] | null,
  ): Promise<DueRow[]> {
    let sections = query.sectionId ? [query.sectionId] : null;
    if (allowed !== null) {
      sections = sections
        ? sections.filter((s) => allowed.includes(s))
        : allowed;
    }
    if (sections && !sections.length) return Promise.resolve([]);
    return this.invoiceRepo.sql<DueRow[]>(
      `SELECT i."student_id", i."enrollment_id", i."id" AS invoice_id,
              to_char(i."due_date", 'YYYY-MM-DD') AS due_date,
              (i."net_total" - i."adjusted_total" - i."allocated_total" + i."refunded_total") AS outstanding,
              trim(s."first_name" || ' ' || coalesce(s."middle_name" || ' ', '') || s."last_name") AS full_name,
              s."admission_number", e."roll_no",
              e."section_id", sec."name" AS section_name,
              e."class_id", c."name" AS class_name
       FROM "invoices" i
       JOIN "students" s ON s."id" = i."student_id"
       JOIN "student_enrollments" e ON e."id" = i."enrollment_id"
       JOIN "sections" sec ON sec."id" = e."section_id"
       JOIN "classes" c ON c."id" = e."class_id"
       WHERE i."org_id" = $1 AND i."status" IN ('open', 'partially_paid')
         AND (i."net_total" - i."adjusted_total" - i."allocated_total" + i."refunded_total") > 0
         AND ($2::uuid IS NULL OR e."class_id" = $2)
         AND ($3::uuid[] IS NULL OR e."section_id" = ANY($3::uuid[]))`,
      [this.invoiceRepo.org, query.classId ?? null, sections],
    );
  }
}

function assertSchoolWide(allowed: string[] | null) {
  if (allowed !== null) {
    throw new ForbiddenException({
      message: 'Finance reports need fees:read school-wide',
      code: 'SCHOOL_WIDE_ONLY',
    });
  }
}
