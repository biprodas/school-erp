import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { QUEUES } from '~/shared/queue';
import { RequestContext } from '~/shared/request-context/request-context.service';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import type { AcademicYear } from '~/modules/academic-years/entities/academic-year.entity';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';
import { AuditService } from '~/modules/audit/services/audit.service';
import type { StudentEnrollment } from '~/modules/enrollments/entities/student-enrollment.entity';
import { EnrollmentService } from '~/modules/enrollments/services/enrollment.service';
import type { Job } from '~/modules/jobs/entities/job.entity';
import { JobService } from '~/modules/jobs/services/job.service';
import { NumberingService } from '~/modules/numbering/numbering.service';
import { patternScope } from '~/modules/numbering/numbering-pattern';
import { SectionService } from '~/modules/sections/section.service';
import { SettingsService } from '~/modules/settings/services/settings.service';
import { bankReference } from '../domain/bank-reference';
import {
  billsIn,
  discountsFor,
  dueDateFor,
  type DiscountRule,
} from '../domain/fee-math';
import { GenerateInvoicesDto } from '../dto/invoice.dto';
import type { BillingRun } from '../entities/billing-run.entity';
import type { StudentDiscount } from '../entities/discount.entity';
import type {
  FeeStructure,
  FeeStructureItem,
} from '../entities/fee-structure.entity';
import type { Invoice } from '../entities/invoice.entity';
import { InvoiceKind, InvoiceLineKind, InvoiceStatus } from '../enums/fee.enum';
import {
  BillingRunRepository,
  InvoiceLineRepository,
  InvoiceRepository,
} from '../repositories/fee.repositories';
import { FeeSetupService } from './fee-setup.service';
import { InvoiceTotalsService } from './invoice-totals.service';
import { StudentDiscountService } from './student-discount.service';

export const BILLING_JOB = 'invoices-generate';

export interface BillingJobData {
  period: string;
  classIds: string[];
  automatic: boolean;
}

export interface BillingSummary {
  billingRunId: string;
  period: string;
  students: number;
  invoicesCreated: number;
  linesCreated: number;
}

/** How specific a structure is: group and shift > one of them > neither. */
const specificity = (s: FeeStructure) =>
  (s.subjectGroupId ? 2 : 0) + (s.shiftId ? 1 : 0);

/**
 * Invoice generation (PRD 6.10, workflow 7.3 step 2): for every active
 * student of the current session, the fee structure items that bill in the
 * period, with approved discounts, on one invoice per student and period.
 * Idempotent: a student's head is billed once per period (a unique line
 * key), so re-running adds only what is new (a structure added later).
 */
@Injectable()
export class BillingService {
  constructor(
    private readonly invoiceRepo: InvoiceRepository,
    private readonly lineRepo: InvoiceLineRepository,
    private readonly runRepo: BillingRunRepository,
    private readonly setup: FeeSetupService,
    private readonly discounts: StudentDiscountService,
    private readonly totals: InvoiceTotalsService,
    private readonly academicYears: AcademicYearService,
    private readonly enrollments: EnrollmentService,
    private readonly sections: SectionService,
    private readonly numbering: NumberingService,
    private readonly settings: SettingsService,
    private readonly jobs: JobService,
    private readonly audit: AuditService,
    private readonly context: RequestContext,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  /** `POST /invoices/generate`: a job; poll `GET /jobs/:id`. */
  async start(dto: GenerateInvoicesDto): Promise<Job> {
    const period = dto.period ?? (await this.settings.today()).slice(0, 7);
    await this.sessionFor(period);
    return this.jobs.start<BillingJobData>({
      type: 'fees.generate',
      queue: QUEUES.billing,
      name: BILLING_JOB,
      data: { period, classIds: dto.classIds ?? [], automatic: false },
      options: { attempts: 1 },
    });
  }

  runs(): Promise<BillingRun[]> {
    return this.runRepo.find({ order: { createdAt: 'DESC' }, take: 50 });
  }

  /** Whether the billing-day scheduler already billed the period. */
  async autoRunExists(period: string): Promise<boolean> {
    return !!(await this.runRepo.findOne({
      where: { period, automatic: true },
    }));
  }

  /** The job's work; one transaction per student, so progress sticks. */
  async generate(
    data: BillingJobData,
    progress: (percent: number) => Promise<void> = () => Promise.resolve(),
  ): Promise<BillingSummary> {
    const { period, automatic } = data;
    const classIds = data.classIds.length ? data.classIds : null;
    const year = await this.sessionFor(period);
    const run = await this.runRepo.saveNew({
      period,
      automatic,
      classIds: data.classIds,
      startedBy: this.context.current().userId,
      invoicesCreated: 0,
      linesCreated: 0,
      finishedAt: null,
    });

    const structures = (
      await this.setup.structuresFor(year.id, classIds)
    ).filter(
      (s) =>
        s.effectiveFrom <= `${period}-31` &&
        (!s.effectiveTo || s.effectiveTo >= `${period}-01`),
    );
    const classSet = [...new Set(structures.map((s) => s.classId))];
    const takers: StudentEnrollment[] = [];
    for (const classId of classSet) {
      takers.push(
        ...(await this.enrollments.findActiveInClass(year.id, classId)),
      );
    }
    const shiftOf = new Map(
      (await this.sections.findInYear(year.id)).map((s) => [s.id, s.shiftId]),
    );
    const discountsByStudent = groupBy(
      await this.discounts.approvedFor(
        [...new Set(takers.map((e) => e.studentId))],
        period,
      ),
      (d) => d.studentId,
    );
    const { dueDay } = await this.settings.getSection('fees');
    const session = {
      startPeriod: year.startDate!.slice(0, 7),
      endPeriod: year.endDate!.slice(0, 7),
    };

    let invoicesCreated = 0;
    let linesCreated = 0;
    for (const [index, e] of takers.entries()) {
      const items = itemsFor(
        e,
        shiftOf.get(e.sectionId) ?? null,
        structures,
      ).filter(
        ({ item }) =>
          item.feeHead!.isActive &&
          billsIn(item.feeHead!.frequency, item.months, period, session),
      );
      if (items.length) {
        const made = await this.ds.runInTransaction(() =>
          this.billStudent(
            e,
            period,
            items,
            discountsByStudent.get(e.studentId) ?? [],
            dueDay,
          ),
        );
        invoicesCreated += made.invoiceCreated ? 1 : 0;
        linesCreated += made.lines;
      }
      if (index % 25 === 24) await progress(((index + 1) / takers.length) * 95);
    }

    await this.runRepo.updateById(run.id, {
      invoicesCreated,
      linesCreated,
      finishedAt: new Date(),
    });
    await this.audit.record({
      action: AUDIT_ACTIONS.INVOICES_GENERATED,
      entityType: 'billing_run',
      entityId: run.id,
      after: { period, automatic, invoicesCreated, linesCreated },
    });
    return {
      billingRunId: run.id,
      period,
      students: takers.length,
      invoicesCreated,
      linesCreated,
    };
  }

  /** A new invoice number and bank reference (inside the caller's transaction). */
  async numbers(): Promise<{ number: string; bankReference: string }> {
    const { invoice } = await this.settings.getSection('numbering');
    return {
      number: await this.numbering.nextFormatted(
        'invoice',
        invoice,
        patternScope(invoice),
      ),
      bankReference: bankReference(await this.numbering.next('bank_reference')),
    };
  }

  private async billStudent(
    e: StudentEnrollment,
    period: string,
    items: { item: FeeStructureItem }[],
    discounts: StudentDiscount[],
    defaultDueDay: number,
  ): Promise<{ invoiceCreated: boolean; lines: number }> {
    const billed = new Set(
      (
        await this.lineRepo.find({
          where: {
            studentId: e.studentId,
            period,
            kind: InvoiceLineKind.FEE,
            cancelled: false,
            feeHeadId: In(items.map((i) => i.item.feeHeadId)),
          },
          select: { id: true, feeHeadId: true },
        })
      ).map((l) => l.feeHeadId),
    );
    const fresh = items.filter((i) => !billed.has(i.item.feeHeadId));
    if (!fresh.length) return { invoiceCreated: false, lines: 0 };

    let invoice: Invoice | null = await this.invoiceRepo.findOne({
      where: {
        enrollmentId: e.id,
        period,
        kind: InvoiceKind.GENERATED,
        status: In([
          InvoiceStatus.OPEN,
          InvoiceStatus.PARTIALLY_PAID,
          InvoiceStatus.PAID,
        ]),
      },
    });
    const created = !invoice;
    if (!invoice) {
      const dueDay = Math.min(
        ...fresh.map((i) => i.item.dueDay ?? defaultDueDay),
      );
      invoice = await this.invoiceRepo.saveNew({
        ...(await this.numbers()),
        kind: InvoiceKind.GENERATED,
        studentId: e.studentId,
        enrollmentId: e.id,
        period,
        issueDate: await this.settings.today(),
        dueDate: dueDateFor(period, dueDay),
        status: InvoiceStatus.OPEN,
        note: null,
        createdBy: this.context.current().userId,
        cancelledAt: null,
        cancelledBy: null,
        cancelReason: null,
      });
    }
    await this.lineRepo.insertMany(
      fresh.map(({ item }) => {
        const rules: DiscountRule[] = discounts
          .filter(
            (d) =>
              d.discountType!.isActive &&
              (!d.discountType!.appliesToHeadIds.length ||
                d.discountType!.appliesToHeadIds.includes(item.feeHeadId)),
          )
          .map((d) => ({
            id: d.discountTypeId,
            kind: d.discountType!.kind,
            value: d.valueOverride ?? d.discountType!.value,
          }));
        const discount = discountsFor(item.amount, rules);
        return {
          invoiceId: invoice.id,
          studentId: e.studentId,
          kind: InvoiceLineKind.FEE,
          feeHeadId: item.feeHeadId,
          lateFineRuleId: null,
          period,
          description: item.feeHead!.name,
          amount: item.amount,
          discount: discount.total,
          discounts: discount.parts.map((p) => ({
            discountTypeId: p.id,
            amount: p.amount,
          })),
          net: item.amount - discount.total,
        };
      }),
    );
    await this.totals.refresh([invoice.id]);
    return { invoiceCreated: created, lines: fresh.length };
  }

  /** The current session, which must contain the period. */
  private async sessionFor(period: string): Promise<AcademicYear> {
    const year = await this.academicYears.findCurrent();
    if (
      !year?.startDate ||
      !year.endDate ||
      period < year.startDate.slice(0, 7) ||
      period > year.endDate.slice(0, 7)
    ) {
      throw new BadRequestException({
        message: 'The period must fall in the current session',
        code: 'PERIOD_OUTSIDE_SESSION',
      });
    }
    return year;
  }
}

/** For each head, the item of the most specific structure that fits. */
function itemsFor(
  e: StudentEnrollment,
  shiftId: string | null,
  structures: FeeStructure[],
): { item: FeeStructureItem }[] {
  const fitting = structures
    .filter(
      (s) =>
        s.classId === e.classId &&
        (!s.subjectGroupId || s.subjectGroupId === e.subjectGroupId) &&
        (!s.shiftId || s.shiftId === shiftId),
    )
    .sort((a, b) => specificity(b) - specificity(a));
  const byHead = new Map<string, FeeStructureItem>();
  for (const s of fitting) {
    for (const item of s.items ?? []) {
      if (!byHead.has(item.feeHeadId)) byHead.set(item.feeHeadId, item);
    }
  }
  return [...byHead.values()].map((item) => ({ item }));
}

function groupBy<T>(rows: T[], key: (t: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of rows) map.set(key(r), [...(map.get(key(r)) ?? []), r]);
  return map;
}
