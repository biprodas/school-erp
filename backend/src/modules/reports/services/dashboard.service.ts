import { Inject, Injectable } from '@nestjs/common';
import { CacheStore } from '~/shared/cache';
import { addDays } from '~/shared/dates/local-date';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import { AccessScope } from '~/modules/access-scope/access-scope.service';
import { AttendanceService } from '~/modules/attendance/services/attendance.service';
import { AttendanceReportService } from '~/modules/attendance/services/attendance-report.service';
import { ClassService } from '~/modules/classes/class.service';
import { EmployeeService } from '~/modules/employees/employee.service';
import { EmployeeStatus } from '~/modules/employees/enums/employee-status.enum';
import { EnrollmentService } from '~/modules/enrollments/services/enrollment.service';
import { ExamService } from '~/modules/exams/services/exam.service';
import { MarkSheetService } from '~/modules/exams/services/mark-sheet.service';
import { FeeReportService } from '~/modules/fees/services/fee-report.service';
import { PaymentService } from '~/modules/fees/services/payment.service';
import { HolidayService } from '~/modules/holidays/holiday.service';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { SettingsService } from '~/modules/settings/services/settings.service';

/** How long a dashboard is served from the cache. */
export const DASHBOARD_TTL_SECONDS = 60;

/**
 * Role dashboards (PRD 6.22): built from the feature modules' own reports
 * so the numbers match them, and cached for 60 seconds per school (per
 * user for the teacher's).
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly cache: CacheStore,
    private readonly scope: AccessScope,
    private readonly academicYears: AcademicYearService,
    private readonly classes: ClassService,
    private readonly enrollments: EnrollmentService,
    private readonly employees: EmployeeService,
    private readonly attendance: AttendanceReportService,
    private readonly registers: AttendanceService,
    private readonly holidays: HolidayService,
    private readonly exams: ExamService,
    private readonly sheets: MarkSheetService,
    private readonly feeReports: FeeReportService,
    private readonly payments: PaymentService,
    private readonly settings: SettingsService,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  /** Enrollment, attendance today, collection, dues, staff, upcoming events. */
  admin() {
    return this.cache.wrap(
      `dash:admin:${this.ds.orgId}`,
      DASHBOARD_TTL_SECONDS,
      async () => {
        const today = await this.settings.today();
        const year = await this.academicYears.findCurrent();
        const counts = year
          ? await this.enrollments.countActiveByClass(year.id)
          : [];
        const byClass = new Map(counts.map((c) => [c.classId, c.students]));
        const classes = await this.classes.findAllOrdered();
        const daily = year
          ? await this.attendance.daily({ date: today }, null)
          : null;
        const staff = await this.employees.findFiltered({
          status: EmployeeStatus.ACTIVE,
          page: 1,
          limit: 1,
        });
        return {
          date: today,
          enrollment: {
            total: counts.reduce((n, c) => n + c.students, 0),
            // In class order, classes without students left out.
            byClass: classes
              .filter((c) => byClass.has(c.id))
              .map((c) => ({
                classId: c.id,
                className: c.name,
                students: byClass.get(c.id)!,
              })),
          },
          attendanceToday: daily
            ? {
                ...daily.school,
                byClass: daily.classes.map((c) => ({
                  classId: c.classId,
                  className: c.className,
                  percentage: c.percentage,
                  submitted: c.submitted,
                  sections: c.sections.length,
                })),
              }
            : null,
          collection: {
            today: await this.feeReports.collectionBetween(today, today),
            monthToDate: await this.feeReports.collectionBetween(
              `${today.slice(0, 7)}-01`,
              today,
            ),
          },
          dues: (await this.feeReports.dues({ asOf: today }, null)).totals,
          staff: { active: staff.meta.total },
          upcoming: await this.upcoming(today, year?.id ?? null),
        };
      },
    );
  }

  /** Today's sections and their registers, and the marks still to enter. */
  async teacher(userId: string) {
    return this.cache.wrap(
      `dash:teacher:${this.ds.orgId}:${userId}`,
      DASHBOARD_TTL_SECONDS,
      async () => {
        const today = await this.settings.today();
        const sections = await this.scope.sections(PERMISSIONS.ATTENDANCE_TAKE);
        const status = await this.attendanceStatus(today, sections);
        const pendingMarks = await this.sheets.pendingFor(
          await this.scope.subjectAssignments(PERMISSIONS.RESULTS_ENTER),
        );
        return {
          date: today,
          sections: status?.rows ?? [],
          pendingAttendance: (status?.rows ?? []).filter(
            (r) => r.status === 'pending',
          ).length,
          pendingMarkSheets: pendingMarks,
        };
      },
    );
  }

  /** Collection, dues and expenses. */
  accountant() {
    return this.cache.wrap(
      `dash:accountant:${this.ds.orgId}`,
      DASHBOARD_TTL_SECONDS,
      async () => {
        const today = await this.settings.today();
        const monthStart = `${today.slice(0, 7)}-01`;
        const recent = await this.payments.findPayments({ page: 1, limit: 10 });
        return {
          date: today,
          collection: {
            today: await this.feeReports.collectionBetween(today, today),
            monthToDate: await this.feeReports.collectionBetween(
              monthStart,
              today,
            ),
          },
          dues: (await this.feeReports.dues({ asOf: today }, null)).totals,
          expenses: {
            monthToDate: await this.feeReports.expensesBetween(
              monthStart,
              today,
            ),
          },
          recentPayments: recent.items.map((p) => ({
            id: p.id,
            amount: p.amount,
            channel: p.channel,
            status: p.status,
            receivedAt: p.receivedAt,
            payer: p.student?.fullName ?? p.payerGuardian?.name ?? '',
          })),
        };
      },
    );
  }

  /** Sections of the session and whether today's register is in. */
  private async attendanceStatus(today: string, sections: string[] | null) {
    if (!(await this.academicYears.findCurrent())) return null;
    return this.registers.submissionStatus({ date: today }, sections);
  }

  /** Holidays and exams in the next 30 days. */
  private async upcoming(today: string, yearId: string | null) {
    const until = addDays(today, 30);
    const holidays = (await this.holidays.findBetween(today, until)).map(
      (h) => ({
        kind: 'holiday' as const,
        title: h.name,
        date: h.dateFrom < today ? today : h.dateFrom,
        endDate: h.dateTo,
      }),
    );
    const exams = yearId
      ? (
          await this.exams.findFiltered({
            academicYearId: yearId,
            page: 1,
            limit: 100,
          })
        ).items
          .filter(
            (x) => x.startDate && x.startDate >= today && x.startDate <= until,
          )
          .map((x) => ({
            kind: 'exam' as const,
            title: x.name,
            date: x.startDate!,
            endDate: x.endDate,
          }))
      : [];
    return [...holidays, ...exams].sort((a, b) => a.date.localeCompare(b.date));
  }
}
