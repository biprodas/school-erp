import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { RequestContext } from '~/shared/request-context/request-context.service';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';
import { AuditService } from '~/modules/audit/services/audit.service';
import { ClassService } from '~/modules/classes/class.service';
import { DOMAIN_EVENTS } from '~/modules/domain-events/domain-events';
import { DomainEventService } from '~/modules/domain-events/domain-event.service';
import type { StudentEnrollment } from '~/modules/enrollments/entities/student-enrollment.entity';
import { EnrollmentService } from '~/modules/enrollments/services/enrollment.service';
import { HolidayService } from '~/modules/holidays/holiday.service';
import type { Section } from '~/modules/sections/entities/section.entity';
import { SectionService } from '~/modules/sections/section.service';
import { SettingsService } from '~/modules/settings/services/settings.service';
import { PeriodService } from '~/modules/timetable/services/period.service';
import {
  RegisterQueryDto,
  SubmissionStatusQueryDto,
  SubmitAttendanceDto,
} from '../dto/attendance.dto';
import type { AttendanceRecord } from '../entities/attendance-record.entity';
import type { AttendanceRegister } from '../entities/attendance-register.entity';
import {
  type AttendanceStatusView,
  CorrectionSource,
  CountsAs,
  LEAVE,
  PRESENT,
} from '../enums/attendance.enum';
import { AttendanceCorrectionRepository } from '../repositories/attendance-correction.repository';
import { AttendanceRecordRepository } from '../repositories/attendance-record.repository';
import {
  AttendanceRegisterRepository,
  type RegisterKey,
} from '../repositories/attendance-register.repository';
import { StudentLeaveRepository } from '../repositories/student-leave.repository';
import { byRoll, isLocked, isWeekend } from './attendance-math';
import { AttendanceStatusService } from './attendance-status.service';

/** Why no attendance is taken on a day. */
export interface DayOff {
  reason: 'holiday' | 'weekend';
  name: string;
}

/** A resolved register request: the section, the day and its rules. */
export interface AttendanceDay extends RegisterKey {
  section: Section;
  today: string;
  dayOff: DayOff | null;
  /** Past the lock window: writing needs `attendance:edit_locked`. */
  locked: boolean;
  future: boolean;
}

export interface RosterEntry {
  enrollmentId: string;
  studentId: string;
  admissionNumber: string;
  name: string;
  nameBn: string | null;
  rollNo: string | null;
  status: string;
  remark: string | null;
  /** On approved leave that day. */
  onLeave: boolean;
  /** Has a saved record (false: the default is shown). */
  recorded: boolean;
  /** Still enrolled in the section (false: left after the register). */
  active: boolean;
}

export type CountSummary = Record<CountsAs, number> & { total: number };

export interface RosterView {
  section: { id: string; name: string; classId: string; className: string };
  date: string;
  periodId: string | null;
  dayOff: DayOff | null;
  locked: boolean;
  register: {
    id: string;
    takenBy: string | null;
    submittedAt: Date;
    updatedAt: Date;
  } | null;
  students: RosterEntry[];
  summary: CountSummary;
}

/** Payload of `attendance.submitted` (for the Phase 1b absentee alerts). */
export interface AttendanceSubmittedEvent extends Record<string, unknown> {
  registerId: string;
  sectionId: string;
  date: string;
  periodId: string | null;
  firstSubmission: boolean;
  /** Enrollments whose status counts as absent after this submission. */
  absentEnrollmentIds: string[];
  submittedBy: string | null;
}

export interface SubmissionStatusRow {
  sectionId: string;
  sectionName: string;
  classId: string;
  className: string;
  status: 'submitted' | 'pending' | 'holiday';
  holiday: string | null;
  registers: number;
  submittedAt: Date | null;
  takenBy: string | null;
}

export const emptySummary = (): CountSummary => ({
  [CountsAs.PRESENT]: 0,
  [CountsAs.ABSENT]: 0,
  [CountsAs.LATE]: 0,
  [CountsAs.LEAVE]: 0,
  [CountsAs.HALF_DAY]: 0,
  total: 0,
});

interface PlannedCorrection {
  enrollmentId: string;
  oldStatus: string;
  newStatus: string;
  source: CorrectionSource;
}

/**
 * Daily student attendance (PRD 6.7, workflow 7.2): a section's roster with
 * everyone Present by default, a submit of the exceptions, corrections that
 * keep the original status, and which sections have not submitted yet.
 *
 * Rules on every write: not on holidays or weekend days
 * (`ATTENDANCE_HOLIDAY`), not in the future, inside the section's session,
 * and past the lock window only with `attendance:edit_locked`. Scope
 * (`attendance:take`, assigned sections) is checked by the controller.
 */
@Injectable()
export class AttendanceService {
  constructor(
    private readonly registerRepo: AttendanceRegisterRepository,
    private readonly recordRepo: AttendanceRecordRepository,
    private readonly correctionRepo: AttendanceCorrectionRepository,
    private readonly leaveRepo: StudentLeaveRepository,
    private readonly statuses: AttendanceStatusService,
    private readonly sections: SectionService,
    private readonly classes: ClassService,
    private readonly academicYears: AcademicYearService,
    private readonly enrollments: EnrollmentService,
    private readonly holidays: HolidayService,
    private readonly periods: PeriodService,
    private readonly settings: SettingsService,
    private readonly events: DomainEventService,
    private readonly audit: AuditService,
    private readonly context: RequestContext,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  // --- Reading -----------------------------------------------------------

  /** `GET /attendance/sections/:id`: the roster with current statuses. */
  async roster(
    sectionId: string,
    query: RegisterQueryDto,
  ): Promise<RosterView> {
    const day = await this.resolveDay(sectionId, query);
    const register = await this.registerRepo.findByKey(day);
    return this.buildRoster(day, register);
  }

  /**
   * `GET /attendance/submission-status`: every active section of the
   * session with whether its register is in for the day. `allowed` is the
   * caller's scope (null = every section).
   */
  async submissionStatus(
    query: SubmissionStatusQueryDto,
    allowed: string[] | null,
  ) {
    const date = query.date ?? (await this.settings.today());
    const periodId = await this.resolvePeriod(query.periodId);
    const year = query.academicYearId
      ? await this.academicYears.findById(query.academicYearId)
      : await this.academicYears.findCurrent();
    const weekendDays = (await this.settings.getSection('locale')).weekendDays;
    const weekend = isWeekend(date, weekendDays);
    if (!year) {
      return {
        date,
        academicYearId: null,
        weekend,
        rows: [],
        totals: totals([]),
      };
    }

    const sections = (await this.sections.findInYear(year.id)).filter(
      (s) => s.isActive && (allowed === null || allowed.includes(s.id)),
    );
    const classNames = new Map(
      (await this.classes.findAllOrdered()).map((c) => [c.id, c]),
    );
    const registers = (
      await this.registerRepo.findOnDate(
        date,
        sections.map((s) => s.id),
      )
    ).filter((r) => !periodId || r.periodId === periodId);
    const holidays = await this.holidays.findBetween(date, date);

    const rows: SubmissionStatusRow[] = sections.map((s) => {
      const own = registers.filter((r) => r.sectionId === s.id);
      const first = own.sort(
        (a, b) => a.submittedAt.getTime() - b.submittedAt.getTime(),
      )[0];
      const holiday = holidays.find(
        (h) => h.classIds.length === 0 || h.classIds.includes(s.classId),
      );
      return {
        sectionId: s.id,
        sectionName: s.name,
        classId: s.classId,
        className: classNames.get(s.classId)?.name ?? '',
        status: first
          ? 'submitted'
          : weekend || holiday
            ? 'holiday'
            : 'pending',
        holiday: holiday?.name ?? null,
        registers: own.length,
        submittedAt: first?.submittedAt ?? null,
        takenBy: first?.takenBy ?? null,
      };
    });
    rows.sort(
      (a, b) =>
        (classNames.get(a.classId)?.level ?? 999) -
          (classNames.get(b.classId)?.level ?? 999) ||
        a.className.localeCompare(b.className) ||
        a.sectionName.localeCompare(b.sectionName),
    );
    return {
      date,
      academicYearId: year.id,
      weekend,
      rows,
      totals: totals(rows),
    };
  }

  // --- Writing -----------------------------------------------------------

  /**
   * `PUT /attendance/sections/:id`: saves the register in one transaction.
   * A change to a recorded status (or to an approved leave) is a
   * correction: it needs `reason` and keeps the original status.
   */
  submit(
    sectionId: string,
    query: RegisterQueryDto,
    dto: SubmitAttendanceDto,
    access: { canEditLocked: boolean },
  ): Promise<RosterView> {
    return this.ds.runInTransaction(async () => {
      const day = await this.resolveDay(sectionId, query);
      this.assertWritable(day, access.canEditLocked);
      const statuses = await this.statuses.byCode();
      const requested = new Map<
        string,
        { status: string; remark?: string | null }
      >();
      for (const entry of dto.records) {
        const status = statuses.get(entry.status);
        if (!status || !status.isActive) {
          throw new BadRequestException({
            message: `Unknown attendance status "${entry.status}"`,
            code: 'UNKNOWN_STATUS',
          });
        }
        if (requested.has(entry.enrollmentId)) {
          throw new BadRequestException({
            message: 'A student appears twice',
            code: 'DUPLICATE_STUDENT',
          });
        }
        requested.set(entry.enrollmentId, entry);
      }

      const userId = this.context.current().userId;
      const { register, created } = await this.registerRepo.getOrCreateLocked(
        day,
        {
          takenBy: userId,
          submittedAt: new Date(),
          clientRequestId: dto.clientRequestId ?? null,
        },
      );
      const existing = created
        ? new Map<string, AttendanceRecord>()
        : new Map(
            (await this.recordRepo.findByRegister(register.id)).map((r) => [
              r.enrollmentId,
              r,
            ]),
          );
      const active = await this.enrollments.findActiveInSection(sectionId);
      const roster = new Set([...active.map((e) => e.id), ...existing.keys()]);
      const outside = [...requested.keys()].filter((id) => !roster.has(id));
      if (outside.length) {
        throw new BadRequestException({
          message: 'Some students are not on this register',
          code: 'NOT_IN_ROSTER',
          enrollmentIds: outside,
        });
      }
      const onLeave = await this.leaveRepo.onLeave([...roster], day.date);

      // Plan every change first, so a missing reason writes nothing.
      const inserts: Partial<AttendanceRecord>[] = [];
      const updates: {
        record: AttendanceRecord;
        status: string;
        remark: string | null;
      }[] = [];
      const corrections: PlannedCorrection[] = [];
      for (const enrollmentId of roster) {
        const wanted = requested.get(enrollmentId);
        const record = existing.get(enrollmentId);
        if (record) {
          if (!wanted) continue;
          const remark =
            wanted.remark !== undefined ? wanted.remark : record.remark;
          if (wanted.status === record.statusCode && remark === record.remark) {
            continue;
          }
          updates.push({ record, status: wanted.status, remark });
          if (wanted.status !== record.statusCode) {
            corrections.push({
              enrollmentId,
              oldStatus: record.statusCode,
              newStatus: wanted.status,
              source: CorrectionSource.MANUAL,
            });
          }
          continue;
        }
        const leave = onLeave.has(enrollmentId);
        const status = wanted?.status ?? (leave ? LEAVE : PRESENT);
        inserts.push({
          registerId: register.id,
          enrollmentId,
          statusCode: status,
          remark: wanted?.remark ?? null,
          updatedBy: userId,
        });
        if (leave && status !== LEAVE) {
          // Overriding an approved leave is a correction of the Leave the
          // approval put in the register.
          corrections.push({
            enrollmentId,
            oldStatus: LEAVE,
            newStatus: status,
            source: CorrectionSource.MANUAL,
          });
        }
      }
      const reason = dto.reason?.trim();
      if (corrections.length && !reason) {
        throw new BadRequestException({
          message: 'Changing recorded attendance needs a reason',
          code: 'CORRECTION_REASON_REQUIRED',
          enrollmentIds: corrections.map((c) => c.enrollmentId),
        });
      }

      await this.recordRepo.insertMany(inserts);
      for (const u of updates) {
        await this.recordRepo.updateFields(u.record.id, {
          statusCode: u.status,
          remark: u.remark,
          updatedBy: userId,
        });
      }
      if (corrections.length) {
        await this.writeCorrections(register, corrections, reason!, userId);
      }
      if (!created) {
        await this.registerRepo.touch(register.id, {
          clientRequestId: dto.clientRequestId ?? register.clientRequestId,
        });
      }

      const view = await this.buildRoster(day, register, statuses);
      await this.events.record(DOMAIN_EVENTS.ATTENDANCE_SUBMITTED, {
        registerId: register.id,
        sectionId,
        date: day.date,
        periodId: day.periodId,
        firstSubmission: created,
        absentEnrollmentIds: view.students
          .filter((s) => statuses.get(s.status)?.countsAs === CountsAs.ABSENT)
          .map((s) => s.enrollmentId),
        submittedBy: userId,
      } satisfies AttendanceSubmittedEvent);
      return view;
    });
  }

  /**
   * Leave approval: sets Leave on the student's records in registers
   * already taken for those days, as corrections. Runs inside the
   * approval's transaction; later registers default to Leave.
   */
  async applyApprovedLeave(input: {
    enrollmentId: string;
    sectionId: string;
    fromDate: string;
    toDate: string;
    leaveId: string;
  }): Promise<number> {
    const registers = await this.registerRepo.findForSection(
      input.sectionId,
      input.fromDate,
      input.toDate,
    );
    const records = await this.recordRepo.findForEnrollment(
      input.enrollmentId,
      registers.map((r) => r.id),
    );
    const userId = this.context.current().userId;
    const changed = records.filter((r) => r.statusCode !== LEAVE);
    for (const record of changed) {
      await this.recordRepo.updateFields(record.id, {
        statusCode: LEAVE,
        updatedBy: userId,
      });
    }
    await this.correctionRepo.insertMany(
      changed.map((r) => ({
        recordId: r.id,
        oldStatus: r.statusCode,
        newStatus: LEAVE,
        reason: `Leave approved (${input.leaveId})`,
        source: CorrectionSource.LEAVE_APPROVAL,
        changedBy: userId,
      })),
    );
    if (changed.length) {
      await this.audit.record({
        action: AUDIT_ACTIONS.ATTENDANCE_CORRECTED,
        entityType: 'student_leave',
        entityId: input.leaveId,
        before: Object.fromEntries(
          changed.map((r) => [r.registerId, r.statusCode]),
        ),
        after: { status: LEAVE, source: CorrectionSource.LEAVE_APPROVAL },
      });
    }
    return changed.length;
  }

  /** The correction history of a register (who changed what, and why). */
  async corrections(sectionId: string, query: RegisterQueryDto) {
    const day = await this.resolveDay(sectionId, query);
    const register = await this.registerRepo.findByKey(day);
    if (!register) return [];
    const records = await this.recordRepo.findByRegister(register.id);
    const byId = new Map(records.map((r) => [r.id, r]));
    const rows = await this.correctionRepo.findForRecords([...byId.keys()]);
    return rows.map((c) => {
      const enrollment = byId.get(c.recordId)!.enrollment;
      return {
        id: c.id,
        enrollmentId: enrollment?.id ?? null,
        studentName: enrollment?.student?.fullName ?? null,
        oldStatus: c.oldStatus,
        newStatus: c.newStatus,
        reason: c.reason,
        source: c.source,
        changedBy: c.changedBy,
        changedAt: c.changedAt,
      };
    });
  }

  // --- Rules -------------------------------------------------------------

  /** The section, day and period of a request, with the day's rules. */
  async resolveDay(
    sectionId: string,
    query: RegisterQueryDto,
  ): Promise<AttendanceDay> {
    const section = await this.sections.findById(sectionId);
    const today = await this.settings.today();
    const date = query.date ?? today;
    const year = section.academicYear;
    if (
      (year?.startDate && date < year.startDate) ||
      (year?.endDate && date > year.endDate)
    ) {
      throw new BadRequestException({
        message: "The date is outside the section's session",
        code: 'DATE_OUTSIDE_SESSION',
      });
    }
    const periodId = await this.resolvePeriod(query.periodId);
    const { lockAfterDays } = await this.settings.getSection('attendance');
    return {
      section,
      sectionId,
      date,
      periodId,
      today,
      dayOff: await this.dayOff(date, section.classId),
      locked: isLocked(date, today, lockAfterDays),
      future: date > today,
    };
  }

  /** Holiday (for the class) or weekend day, else null. */
  async dayOff(date: string, classId: string): Promise<DayOff | null> {
    const holiday = await this.holidays.findOn(date, classId);
    if (holiday) return { reason: 'holiday', name: holiday.name };
    const { weekendDays } = await this.settings.getSection('locale');
    return isWeekend(date, weekendDays)
      ? { reason: 'weekend', name: 'Weekend' }
      : null;
  }

  private assertWritable(day: AttendanceDay, canEditLocked: boolean): void {
    if (day.dayOff) {
      throw new ConflictException({
        message: `No attendance on ${day.date}: ${day.dayOff.name}`,
        code: 'ATTENDANCE_HOLIDAY',
      });
    }
    if (day.future) {
      throw new BadRequestException({
        message: 'Attendance cannot be taken for a future day',
        code: 'ATTENDANCE_FUTURE_DATE',
      });
    }
    if (day.locked && !canEditLocked) {
      throw new ForbiddenException({
        message: 'This day is locked; it needs attendance:edit_locked',
        code: 'ATTENDANCE_LOCKED',
      });
    }
  }

  /** Day mode takes no period; period mode needs one. */
  private async resolvePeriod(periodId?: string): Promise<string | null> {
    const { mode } = await this.settings.getSection('attendance');
    if (mode === 'day') {
      if (periodId) {
        throw new BadRequestException({
          message: 'The school takes attendance by day, not by period',
          code: 'PERIOD_MODE_OFF',
        });
      }
      return null;
    }
    if (!periodId) {
      throw new BadRequestException({
        message: 'The school takes attendance by period: pick a period',
        code: 'PERIOD_REQUIRED',
      });
    }
    await this.periods.findById(periodId);
    return periodId;
  }

  // --- Helpers -----------------------------------------------------------

  private async writeCorrections(
    register: AttendanceRegister,
    corrections: PlannedCorrection[],
    reason: string,
    userId: string | null,
  ): Promise<void> {
    const records = new Map(
      (
        await this.recordRepo.findByRegisterAndEnrollments(
          register.id,
          corrections.map((c) => c.enrollmentId),
        )
      ).map((r) => [r.enrollmentId, r.id]),
    );
    await this.correctionRepo.insertMany(
      corrections.map((c) => ({
        recordId: records.get(c.enrollmentId)!,
        oldStatus: c.oldStatus,
        newStatus: c.newStatus,
        reason,
        source: c.source,
        changedBy: userId,
      })),
    );
    await this.audit.record({
      action: AUDIT_ACTIONS.ATTENDANCE_CORRECTED,
      entityType: 'attendance_register',
      entityId: register.id,
      before: Object.fromEntries(
        corrections.map((c) => [c.enrollmentId, c.oldStatus]),
      ),
      after: {
        ...Object.fromEntries(
          corrections.map((c) => [c.enrollmentId, c.newStatus]),
        ),
        reason,
      },
    });
  }

  private async buildRoster(
    day: AttendanceDay,
    register: AttendanceRegister | null,
    statusMap?: Map<string, AttendanceStatusView>,
  ): Promise<RosterView> {
    const statuses = statusMap ?? (await this.statuses.byCode());
    const active = await this.enrollments.findActiveInSection(day.sectionId);
    const records = register
      ? await this.recordRepo.findByRegister(register.id)
      : [];
    const recorded = new Map(records.map((r) => [r.enrollmentId, r]));
    const enrollments = new Map<string, StudentEnrollment>(
      active.map((e) => [e.id, e]),
    );
    for (const r of records) {
      if (r.enrollment && !enrollments.has(r.enrollmentId)) {
        enrollments.set(r.enrollmentId, r.enrollment);
      }
    }
    const activeIds = new Set(active.map((e) => e.id));
    const onLeave = await this.leaveRepo.onLeave(
      [...enrollments.keys()],
      day.date,
    );

    const summary = emptySummary();
    const students: RosterEntry[] = [...enrollments.values()].map((e) => {
      const record = recorded.get(e.id);
      const leave = onLeave.has(e.id);
      const status = record?.statusCode ?? (leave ? LEAVE : PRESENT);
      const countsAs = statuses.get(status)?.countsAs ?? CountsAs.PRESENT;
      summary[countsAs]++;
      summary.total++;
      return {
        enrollmentId: e.id,
        studentId: e.studentId,
        admissionNumber: e.student?.admissionNumber ?? '',
        name: e.student?.fullName ?? '',
        nameBn: e.student?.nameBn ?? null,
        rollNo: e.rollNo,
        status,
        remark: record?.remark ?? null,
        onLeave: leave,
        recorded: !!record,
        active: activeIds.has(e.id),
      };
    });
    students.sort(
      (a, b) => byRoll(a.rollNo, b.rollNo) || a.name.localeCompare(b.name),
    );

    return {
      section: {
        id: day.section.id,
        name: day.section.name,
        classId: day.section.classId,
        className: day.section.schoolClass?.name ?? '',
      },
      date: day.date,
      periodId: day.periodId,
      dayOff: day.dayOff,
      locked: day.locked,
      register: register && {
        id: register.id,
        takenBy: register.takenBy,
        submittedAt: register.submittedAt,
        updatedAt: register.updatedAt,
      },
      students,
      summary,
    };
  }
}

function totals(rows: SubmissionStatusRow[]) {
  return {
    sections: rows.length,
    submitted: rows.filter((r) => r.status === 'submitted').length,
    pending: rows.filter((r) => r.status === 'pending').length,
    holiday: rows.filter((r) => r.status === 'holiday').length,
  };
}
