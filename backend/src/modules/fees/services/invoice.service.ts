import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FindOptionsWhere, In, IsNull } from 'typeorm';
import { Paginated } from '~/common/dto/paginated.dto';
import { DEFAULT_PAGE_SIZE } from '~/common/dto/pagination-query.dto';
import { RequestContext } from '~/shared/request-context/request-context.service';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';
import { AuditService } from '~/modules/audit/services/audit.service';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import { EnrollmentService } from '~/modules/enrollments/services/enrollment.service';
import { StudentService } from '~/modules/students/services/student.service';
import { SettingsService } from '~/modules/settings/services/settings.service';
import { lineOutstanding } from '../domain/fee-math';
import { CreateInvoiceDto, FilterInvoiceDto } from '../dto/invoice.dto';
import type { Invoice } from '../entities/invoice.entity';
import { InvoiceKind, InvoiceLineKind, InvoiceStatus } from '../enums/fee.enum';
import {
  InvoiceLineRepository,
  InvoiceRepository,
  PaymentAllocationRepository,
} from '../repositories/fee.repositories';
import { BillingService } from './billing.service';
import { FeeSetupService } from './fee-setup.service';
import {
  invoiceOutstanding,
  InvoiceTotalsService,
} from './invoice-totals.service';

/** An invoice as the API shows it: totals plus what is outstanding. */
export type InvoiceView = Invoice & { outstanding: number };

const view = (i: Invoice): InvoiceView =>
  Object.assign(i, {
    outstanding: invoiceOutstanding(i),
    lines: i.lines?.map((l) =>
      Object.assign(l, { outstanding: lineOutstanding(l) }),
    ),
  });

/**
 * Invoices (PRD 6.10): lists and statements by student, ad hoc invoices,
 * and cancelling an invoice nothing has been paid against. `allowed` is
 * the caller's sections (null = every one).
 */
@Injectable()
export class InvoiceService {
  constructor(
    private readonly invoiceRepo: InvoiceRepository,
    private readonly lineRepo: InvoiceLineRepository,
    private readonly allocationRepo: PaymentAllocationRepository,
    private readonly billing: BillingService,
    private readonly setup: FeeSetupService,
    private readonly totals: InvoiceTotalsService,
    private readonly students: StudentService,
    private readonly enrollments: EnrollmentService,
    private readonly academicYears: AcademicYearService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly context: RequestContext,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  async findFiltered(
    filter: FilterInvoiceDto,
    allowed: string[] | null,
  ): Promise<Paginated<InvoiceView>> {
    const where: FindOptionsWhere<Invoice> = {};
    if (filter.studentId) where.studentId = filter.studentId;
    if (filter.period) where.period = filter.period;
    if (filter.status) where.status = filter.status;
    let sections = filter.sectionId ? [filter.sectionId] : null;
    if (allowed !== null) {
      sections = sections
        ? sections.filter((s) => allowed.includes(s))
        : allowed;
    }
    if (sections && !sections.length) {
      const { page = 1, limit = DEFAULT_PAGE_SIZE } = filter;
      return new Paginated<InvoiceView>([], 0, { page, limit });
    }
    if (sections || filter.classId) {
      where.enrollment = {
        ...(sections ? { sectionId: In(sections) } : {}),
        ...(filter.classId ? { classId: filter.classId } : {}),
      };
    }
    const page = await this.invoiceRepo.findPage(
      {
        where,
        relations: {
          student: true,
          enrollment: { section: true, schoolClass: true },
        },
        order: { dueDate: 'DESC', number: 'DESC' },
      },
      filter,
    );
    return new Paginated(page.items.map(view), page.meta.total, page.meta);
  }

  /** One invoice with its lines and the payments against it. */
  async findById(
    id: string,
    allowed: string[] | null = null,
  ): Promise<InvoiceView> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id },
      relations: {
        student: true,
        enrollment: { section: true, schoolClass: true },
        lines: { feeHead: true },
      },
      order: { lines: { createdAt: 'ASC' } },
    });
    if (
      !invoice ||
      (allowed !== null && !allowed.includes(invoice.enrollment!.sectionId))
    ) {
      throw new NotFoundException(`Invoice "${id}" not found`);
    }
    return view(invoice);
  }

  /** A student's invoices and what they owe in all. */
  async statement(studentId: string) {
    await this.students.findById(studentId);
    const invoices = await this.invoiceRepo.find({
      where: { studentId },
      relations: { lines: { feeHead: true } },
      order: { dueDate: 'ASC', lines: { createdAt: 'ASC' } },
    });
    const live = invoices.filter((i) => i.status !== InvoiceStatus.CANCELLED);
    return {
      studentId,
      billed: live.reduce((n, i) => n + i.total, 0),
      discounts: live.reduce((n, i) => n + i.discountTotal, 0),
      adjusted: live.reduce((n, i) => n + i.adjustedTotal, 0),
      collected: live.reduce(
        (n, i) => n + i.allocatedTotal - i.refundedTotal,
        0,
      ),
      outstanding: live.reduce((n, i) => n + invoiceOutstanding(i), 0),
      invoices: invoices.map(view),
    };
  }

  /** An ad hoc invoice on the student's current enrollment. */
  create(dto: CreateInvoiceDto): Promise<InvoiceView> {
    return this.ds.runInTransaction(async () => {
      await this.students.findById(dto.studentId);
      const year = await this.academicYears.findCurrent();
      const enrollment = year
        ? await this.enrollments.findForStudentYear(dto.studentId, year.id)
        : null;
      if (!enrollment) {
        throw new ConflictException({
          message: 'The student is not enrolled in the current session',
          code: 'NOT_ENROLLED',
        });
      }
      for (const l of dto.lines)
        if (l.feeHeadId) await this.setup.findHead(l.feeHeadId);
      const today = await this.settings.today();
      const invoice = await this.invoiceRepo.saveNew({
        ...(await this.billing.numbers()),
        kind: InvoiceKind.ADHOC,
        studentId: dto.studentId,
        enrollmentId: enrollment.id,
        period: today.slice(0, 7),
        issueDate: today,
        dueDate: dto.dueDate ?? today,
        status: InvoiceStatus.OPEN,
        note: dto.note ?? null,
        createdBy: this.context.current().userId,
        cancelledAt: null,
        cancelledBy: null,
        cancelReason: null,
      });
      await this.lineRepo.insertMany(
        dto.lines.map((l) => ({
          invoiceId: invoice.id,
          studentId: dto.studentId,
          kind: InvoiceLineKind.ADHOC,
          feeHeadId: l.feeHeadId ?? null,
          lateFineRuleId: null,
          period: invoice.period,
          description: l.description,
          amount: l.amount,
          discount: 0,
          discounts: [],
          net: l.amount,
        })),
      );
      await this.totals.refresh([invoice.id]);
      return this.findById(invoice.id);
    });
  }

  /** Only while nothing is allocated to it; the record stays, cancelled. */
  cancel(id: string, reason: string): Promise<InvoiceView> {
    return this.ds.runInTransaction(async () => {
      const invoice = await this.findById(id);
      if (invoice.status === InvoiceStatus.CANCELLED) {
        throw new ConflictException({
          message: 'The invoice is already cancelled',
          code: 'INVOICE_CANCELLED',
        });
      }
      const paid = await this.allocationRepo.count({
        where: { invoiceId: id, reversedAt: IsNull() },
      });
      if (paid) {
        throw new ConflictException({
          message:
            'Payments are allocated to this invoice: cancel their receipts first',
          code: 'INVOICE_HAS_PAYMENTS',
        });
      }
      await this.lineRepo.updateWhere({ invoiceId: id }, { cancelled: true });
      await this.invoiceRepo.updateById(id, {
        status: InvoiceStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledBy: this.context.current().userId,
        cancelReason: reason,
      });
      await this.totals.refresh([id]);
      await this.audit.record({
        action: AUDIT_ACTIONS.INVOICE_CANCELLED,
        entityType: 'invoice',
        entityId: id,
        before: { status: invoice.status, netTotal: invoice.netTotal },
        after: { status: InvoiceStatus.CANCELLED, reason },
      });
      return this.findById(id);
    });
  }
}
