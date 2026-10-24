import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AttendanceReportService } from '~/modules/attendance/services/attendance-report.service';
import { StudentLeaveService } from '~/modules/attendance/services/student-leave.service';
import { monthRange } from '~/modules/attendance/services/attendance-math';
import { EnrollmentService } from '~/modules/enrollments/services/enrollment.service';
import { ExamService } from '~/modules/exams/services/exam.service';
import { ResultService } from '~/modules/exams/services/result.service';
import { FeeReportService } from '~/modules/fees/services/fee-report.service';
import { InvoiceStatus } from '~/modules/fees/enums/fee.enum';
import { InvoiceService } from '~/modules/fees/services/invoice.service';
import { PaymentService } from '~/modules/fees/services/payment.service';
import { NoticeService } from '~/modules/notices/services/notice.service';
import { SettingsService } from '~/modules/settings/services/settings.service';
import { PortalLeaveDto } from '../dto/portal.dto';
import { PortalAccessService } from './portal-access.service';

/**
 * The guardian and student portal (PRD 6.14) over the staff modules,
 * always for one of the user's own children (`PortalAccessService`).
 * Results honour `fees.blockResultsOnDues`.
 */
@Injectable()
export class PortalService {
  constructor(
    private readonly access: PortalAccessService,
    private readonly attendanceReports: AttendanceReportService,
    private readonly leaveService: StudentLeaveService,
    private readonly exams: ExamService,
    private readonly resultService: ResultService,
    private readonly invoices: InvoiceService,
    private readonly paymentService: PaymentService,
    private readonly feeReports: FeeReportService,
    private readonly notices: NoticeService,
    private readonly settings: SettingsService,
    private readonly enrollments: EnrollmentService,
  ) {}

  /** Today's attendance, the session so far, upcoming exams, dues, notices. */
  async dashboard(studentId: string, userId: string) {
    const child = await this.access.child(studentId);
    const today = await this.settings.today();
    const e = child.enrollment;
    const todayStatus = e
      ? ((await this.attendanceReports.enrollmentDays(e.id, today, today))
          .days[0] ?? null)
      : null;
    const statement = await this.invoices.statement(studentId);
    const nextDue = statement.invoices
      .filter((i) => i.status !== InvoiceStatus.CANCELLED && i.outstanding > 0)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    return {
      child,
      attendance: {
        today: todayStatus,
        session: e
          ? await this.attendanceReports.enrollmentSummary(e.id)
          : null,
      },
      upcomingExams: e
        ? (
            await this.exams.upcomingForClass(
              e.academicYearId,
              e.classId,
              today,
            )
          ).map((x) => ({
            id: x.id,
            name: x.name,
            startDate: x.startDate,
            endDate: x.endDate,
          }))
        : [],
      dues: {
        outstanding: statement.outstanding,
        nextDueDate: nextDue?.dueDate ?? null,
        nextDueAmount: nextDue?.outstanding ?? 0,
      },
      notices: (await this.notices.feed(userId, { page: 1, limit: 5 })).items,
    };
  }

  async attendance(studentId: string, month?: string) {
    const { enrollment } = await this.access.enrollmentOf(studentId);
    const { from, to } = monthRange(
      month ?? (await this.settings.today()).slice(0, 7),
    );
    return this.attendanceReports.enrollmentDays(enrollment.id, from, to);
  }

  /** Published results, unless dues hold them back. */
  async results(studentId: string) {
    await this.access.child(studentId);
    if (await this.heldForDues(studentId)) {
      return { blocked: true, reason: 'RESULTS_HELD_FOR_DUES', results: [] };
    }
    const history = await this.enrollmentIdsOf(studentId);
    return {
      blocked: false,
      results: await this.resultService.publishedFor(history),
    };
  }

  async result(studentId: string, resultId: string) {
    await this.assertResultOf(studentId, resultId);
    return this.resultService.row(resultId, null);
  }

  async reportCard(studentId: string, resultId: string) {
    await this.assertResultOf(studentId, resultId);
    return this.resultService.reportCardUrl(resultId, null);
  }

  async fees(studentId: string) {
    await this.access.child(studentId);
    return this.invoices.statement(studentId);
  }

  /** Payments of all the user's children here (one guardian payment can cover several). */
  async payments() {
    const ids = (await this.access.children()).map((c) => c.studentId);
    return this.paymentService.paymentsForStudents(ids);
  }

  async receiptPdf(receiptId: string, paper: '80mm' | 'A4') {
    const ids = (await this.access.children()).map((c) => c.studentId);
    if (!(await this.paymentService.receiptCovers(receiptId, ids))) {
      throw new NotFoundException(`Receipt "${receiptId}" not found`);
    }
    return this.paymentService.startReceiptPdf(receiptId, paper);
  }

  async applyLeave(studentId: string, dto: PortalLeaveDto) {
    const { enrollment } = await this.access.enrollmentOf(studentId);
    return this.leaveService.create({
      enrollmentId: enrollment.id,
      fromDate: dto.fromDate,
      toDate: dto.toDate,
      reason: dto.reason,
    });
  }

  async leaves(studentId: string) {
    await this.access.child(studentId);
    return this.leaveService.findFiltered(
      { studentId, page: 1, limit: 100 },
      null,
    );
  }

  private async heldForDues(studentId: string): Promise<boolean> {
    if (!(await this.settings.getSection('fees')).blockResultsOnDues)
      return false;
    return (await this.feeReports.hasDues([studentId])).has(studentId);
  }

  /** Every enrollment of the child, past sessions included. */
  private async enrollmentIdsOf(studentId: string): Promise<string[]> {
    return (await this.enrollments.findForStudent(studentId)).map((e) => e.id);
  }

  private async assertResultOf(studentId: string, resultId: string) {
    await this.access.child(studentId);
    const published = await this.resultService.publishedFor(
      await this.enrollmentIdsOf(studentId),
    );
    if (!published.some((r) => r.id === resultId)) {
      throw new NotFoundException(`Result "${resultId}" not found`);
    }
    if (await this.heldForDues(studentId)) {
      throw new ForbiddenException({
        message: 'Results are held until the dues are cleared',
        code: 'RESULTS_HELD_FOR_DUES',
      });
    }
  }
}
