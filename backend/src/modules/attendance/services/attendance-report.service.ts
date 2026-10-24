import { BadRequestException, Injectable } from '@nestjs/common';
import { QUEUES } from '~/shared/queue';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import type { AcademicYear } from '~/modules/academic-years/entities/academic-year.entity';
import { ClassService } from '~/modules/classes/class.service';
import { EnrollmentService } from '~/modules/enrollments/services/enrollment.service';
import {
  HolidayService,
  appliesToClass,
} from '~/modules/holidays/holiday.service';
import type { Job } from '~/modules/jobs/entities/job.entity';
import { JobService } from '~/modules/jobs/services/job.service';
import { SectionService } from '~/modules/sections/section.service';
import { SettingsService } from '~/modules/settings/services/settings.service';
import {
  AttendanceRangeQueryDto,
  DailySummaryQueryDto,
  DefaultersQueryDto,
  LateComersQueryDto,
  MonthlyRegisterPdfDto,
} from '../dto/attendance-report.dto';
import type { AttendanceRegister } from '../entities/attendance-register.entity';
import { type AttendanceStatusView, CountsAs } from '../enums/attendance.enum';
import {
  AttendanceRecordRepository,
  type StatusCount,
} from '../repositories/attendance-record.repository';
import { AttendanceRegisterRepository } from '../repositories/attendance-register.repository';
import {
  type AttendanceTally,
  addToTally,
  attendancePercentage,
  byRoll,
  datesBetween,
  emptyTally,
  isWeekend,
  monthRange,
  sumTallies,
  weekdayOf,
} from './attendance-math';
import { AttendanceStatusService } from './attendance-status.service';

export const MONTHLY_REGISTER_JOB = 'attendance-monthly-register';

export interface TallyView extends AttendanceTally {
  percentage: number | null;
}

/** One student in a student list (defaulters, late-comers). */
export interface StudentAttendanceRow extends TallyView {
  enrollmentId: string;
  studentId: string;
  admissionNumber: string;
  name: string;
  nameBn: string | null;
  rollNo: string | null;
  classId: string;
  className: string;
  sectionId: string;
  sectionName: string;
}

export interface DailySectionRow extends TallyView {
  sectionId: string;
  sectionName: string;
  /** Active enrollments now. */
  enrolled: number;
  submitted: boolean;
  holiday: string | null;
}

export interface DailyClassRow extends TallyView {
  classId: string;
  className: string;
  enrolled: number;
  /** Sections whose register is in. */
  submitted: number;
  sections: DailySectionRow[];
}

export interface MonthlyRegister {
  section: { id: string; name: string; className: string; session: string };
  month: string;
  days: {
    date: string;
    day: number;
    weekday: string;
    /** No school that day. */
    off: 'holiday' | 'weekend' | null;
    offName: string | null;
    taken: boolean;
    /** Students attending that day (present, late, half-day). */
    attended: number;
  }[];
  students: (TallyView & {
    enrollmentId: string;
    rollNo: string | null;
    name: string;
    nameBn: string | null;
    admissionNumber: string;
    /** One symbol per day (`''` = no record). */
    cells: string[];
  })[];
  legend: {
    symbol: string;
    label: string;
    labelBn: string;
    countsAs: CountsAs;
  }[];
}

const withPercentage = (t: AttendanceTally): TallyView => ({
  ...t,
  percentage: attendancePercentage(t),
});

const ATTENDED = new Set([CountsAs.PRESENT, CountsAs.LATE, CountsAs.HALF_DAY]);

/**
 * Attendance reports (PRD 6.7): the daily summary by class and section,
 * the monthly register (JSON, and the paper layout as a PDF job),
 * defaulters below a percentage and late-comers. A student's day status
 * comes from the day register, or in period mode from the first period
 * taken that day. Callers pass their scope (`allowed` section ids, null =
 * every section).
 */
@Injectable()
export class AttendanceReportService {
  constructor(
    private readonly registerRepo: AttendanceRegisterRepository,
    private readonly recordRepo: AttendanceRecordRepository,
    private readonly statuses: AttendanceStatusService,
    private readonly sections: SectionService,
    private readonly classes: ClassService,
    private readonly academicYears: AcademicYearService,
    private readonly enrollments: EnrollmentService,
    private readonly holidays: HolidayService,
    private readonly settings: SettingsService,
    private readonly jobs: JobService,
  ) {}

  /** Today's (or a day's) attendance by class and section. */
  async daily(query: DailySummaryQueryDto, allowed: string[] | null) {
    const date = query.date ?? (await this.settings.today());
    const year = await this.year(query.academicYearId);
    const statuses = await this.statuses.byCode();
    const { weekendDays } = await this.settings.getSection('locale');
    const sections = (await this.sections.findInYear(year.id)).filter(
      (s) => s.isActive && (allowed === null || allowed.includes(s.id)),
    );
    const registers = dayRegisters(
      await this.registerRepo.findOnDate(
        date,
        sections.map((s) => s.id),
      ),
    );
    const counts = groupCounts(
      await this.recordRepo.countByRegister(
        [...registers.values()].map((r) => r.id),
      ),
    );
    const holidays = await this.holidays.findBetween(date, date);
    const classList = await this.classes.findAllOrdered();

    const classes: DailyClassRow[] = [];
    for (const cls of classList) {
      const own = sections
        .filter((s) => s.classId === cls.id)
        .sort((a, b) => a.name.localeCompare(b.name));
      if (!own.length) continue;
      const rows: DailySectionRow[] = [];
      for (const s of own) {
        const register = registers.get(s.id);
        const tally = register
          ? tallyOf(counts.get(register.id) ?? [], statuses)
          : emptyTally();
        rows.push({
          sectionId: s.id,
          sectionName: s.name,
          enrolled: await this.enrollments.countActiveInSection(s.id),
          submitted: !!register,
          holiday:
            holidays.find((h) => appliesToClass(h, cls.id))?.name ?? null,
          ...withPercentage(tally),
        });
      }
      const tally = sumTallies(rows);
      classes.push({
        classId: cls.id,
        className: cls.name,
        enrolled: rows.reduce((n, r) => n + r.enrolled, 0),
        submitted: rows.filter((r) => r.submitted).length,
        sections: rows,
        ...withPercentage(tally),
      });
    }
    const school = sumTallies(classes);
    return {
      date,
      academicYearId: year.id,
      weekend: isWeekend(date, weekendDays),
      classes,
      school: {
        enrolled: classes.reduce((n, c) => n + c.enrolled, 0),
        sections: sections.length,
        submitted: registers.size,
        ...withPercentage(school),
      },
    };
  }

  /** The month's register grid for a section (also the PDF's data). */
  async monthly(sectionId: string, month: string): Promise<MonthlyRegister> {
    const section = await this.sections.findById(sectionId);
    const { from, to } = monthRange(month);
    const statuses = await this.statuses.byCode();
    const { weekendDays } = await this.settings.getSection('locale');
    const holidays = (await this.holidays.findBetween(from, to)).filter((h) =>
      appliesToClass(h, section.classId),
    );
    const marks = await this.recordRepo.dayStatuses({
      from,
      to,
      sectionIds: [sectionId],
    });
    const active = await this.enrollments.findActiveInSection(sectionId);
    const ids = new Set([
      ...active.map((e) => e.id),
      ...marks.map((m) => m.enrollmentId),
    ]);
    const enrollments = await this.enrollments.findByIds([...ids]);
    enrollments.sort(
      (a, b) =>
        byRoll(a.rollNo, b.rollNo) ||
        (a.student?.fullName ?? '').localeCompare(b.student?.fullName ?? ''),
    );

    const dates = datesBetween(from, to);
    const index = new Map(dates.map((d, i) => [d, i]));
    const byEnrollment = new Map<string, Map<string, string>>();
    for (const m of marks) {
      if (!byEnrollment.has(m.enrollmentId)) {
        byEnrollment.set(m.enrollmentId, new Map());
      }
      byEnrollment.get(m.enrollmentId)!.set(m.date, m.statusCode);
    }
    const taken = new Set(marks.map((m) => m.date));
    const attended = dates.map(() => 0);

    const students = enrollments.map((e) => {
      const own = byEnrollment.get(e.id) ?? new Map<string, string>();
      const cells = dates.map(() => '');
      const tally = emptyTally();
      for (const [date, code] of own) {
        const status = statuses.get(code);
        const i = index.get(date)!;
        cells[i] = status?.symbol ?? code;
        const countsAs = status?.countsAs ?? CountsAs.PRESENT;
        addToTally(tally, countsAs);
        if (ATTENDED.has(countsAs)) attended[i]++;
      }
      return {
        enrollmentId: e.id,
        rollNo: e.rollNo,
        name: e.student?.fullName ?? '',
        nameBn: e.student?.nameBn ?? null,
        admissionNumber: e.student?.admissionNumber ?? '',
        cells,
        ...withPercentage(tally),
      };
    });

    return {
      section: {
        id: section.id,
        name: section.name,
        className: section.schoolClass?.name ?? '',
        session: section.academicYear?.name ?? '',
      },
      month,
      days: dates.map((date, i) => {
        const holiday = holidays.find(
          (h) => h.dateFrom <= date && h.dateTo >= date,
        );
        const weekend = isWeekend(date, weekendDays);
        return {
          date,
          day: Number(date.slice(8)),
          weekday: weekdayOf(date).slice(0, 3),
          off: holiday ? 'holiday' : weekend ? 'weekend' : null,
          offName: holiday?.name ?? (weekend ? 'Weekend' : null),
          taken: taken.has(date),
          attended: attended[i],
        };
      }),
      students,
      legend: [...statuses.values()]
        .filter((s) => s.isActive)
        .map((s) => ({
          symbol: s.symbol,
          label: s.labelEn,
          labelBn: s.labelBn,
          countsAs: s.countsAs,
        })),
    };
  }

  /** Queues the monthly register PDF; poll `GET /jobs/:id`. */
  async startMonthlyPdf(dto: MonthlyRegisterPdfDto): Promise<Job> {
    await this.sections.findById(dto.sectionId);
    return this.jobs.start<MonthlyRegisterPdfDto>({
      type: 'attendance.monthly_register',
      queue: QUEUES.pdf,
      name: MONTHLY_REGISTER_JOB,
      data: {
        sectionId: dto.sectionId,
        month: dto.month,
        paper: dto.paper ?? 'A4-landscape',
      },
    });
  }

  /** Students below `threshold` percent, lowest first. */
  async defaulters(query: DefaultersQueryDto, allowed: string[] | null) {
    const threshold = query.threshold ?? 75;
    const { range, rows } = await this.studentRows(query, allowed);
    return {
      ...range,
      threshold,
      rows: rows
        .filter((r) => r.percentage !== null && r.percentage < threshold)
        .sort((a, b) => a.percentage! - b.percentage! || cmpRow(a, b)),
    };
  }

  /** Students late at least `minLate` days, most first. */
  async lateComers(query: LateComersQueryDto, allowed: string[] | null) {
    const minLate = query.minLate ?? 1;
    const { range, rows } = await this.studentRows(query, allowed);
    return {
      ...range,
      minLate,
      rows: rows
        .filter((r) => r.late >= minLate)
        .sort((a, b) => b.late - a.late || cmpRow(a, b)),
    };
  }

  /** One enrollment's tally over its session up to today (student 360). */
  async enrollmentSummary(enrollmentId: string): Promise<
    | (TallyView & {
        from: string;
        to: string;
      })
    | null
  > {
    const enrollment = await this.enrollments.findById(enrollmentId);
    const year = enrollment.academicYear;
    if (!year?.startDate) return null;
    const range = clampRange(
      year,
      undefined,
      undefined,
      await this.settings.today(),
    );
    const statuses = await this.statuses.byCode();
    const counts = await this.recordRepo.countDaysByEnrollment({
      ...range,
      sectionIds: null,
      enrollmentIds: [enrollmentId],
    });
    return { ...range, ...withPercentage(tallyOf(counts, statuses)) };
  }

  /**
   * `enrollmentSummary` for many enrollments of one session, in one query
   * (a section's report cards). Enrollments with no records get zeros.
   */
  async enrollmentSummaries(
    academicYearId: string,
    enrollmentIds: string[],
  ): Promise<Map<string, TallyView & { from: string; to: string }>> {
    const summaries = new Map<
      string,
      TallyView & { from: string; to: string }
    >();
    if (!enrollmentIds.length) return summaries;
    const year = await this.academicYears.findById(academicYearId);
    if (!year.startDate) return summaries;
    const range = clampRange(
      year,
      undefined,
      undefined,
      await this.settings.today(),
    );
    const statuses = await this.statuses.byCode();
    const counts = await this.recordRepo.countDaysByEnrollment({
      ...range,
      sectionIds: null,
      enrollmentIds,
    });
    const byEnrollment = groupCounts(counts);
    for (const id of enrollmentIds) {
      summaries.set(id, {
        ...range,
        ...withPercentage(tallyOf(byEnrollment.get(id) ?? [], statuses)),
      });
    }
    return summaries;
  }

  /** One enrollment's day statuses over a range (the portal's history). */
  async enrollmentDays(enrollmentId: string, from: string, to: string) {
    const statuses = await this.statuses.byCode();
    const days = (
      await this.recordRepo.dayStatuses({
        from,
        to,
        sectionIds: null,
        enrollmentIds: [enrollmentId],
      })
    ).sort((a, b) => a.date.localeCompare(b.date));
    const tally = emptyTally();
    for (const d of days) {
      addToTally(
        tally,
        statuses.get(d.statusCode)?.countsAs ?? CountsAs.PRESENT,
      );
    }
    return {
      from,
      to,
      ...withPercentage(tally),
      days: days.map((d) => {
        const s = statuses.get(d.statusCode);
        return {
          date: d.date,
          status: d.statusCode,
          label: s?.labelEn ?? d.statusCode,
          labelBn: s?.labelBn ?? d.statusCode,
          countsAs: s?.countsAs ?? CountsAs.PRESENT,
        };
      }),
    };
  }

  private async studentRows(
    query: AttendanceRangeQueryDto,
    allowed: string[] | null,
  ): Promise<{
    range: { academicYearId: string; from: string; to: string };
    rows: StudentAttendanceRow[];
  }> {
    const year = await this.year(query.academicYearId);
    const range = clampRange(
      year,
      query.from,
      query.to,
      await this.settings.today(),
    );
    const sectionIds = (await this.sections.findInYear(year.id))
      .filter(
        (s) =>
          (!query.classId || s.classId === query.classId) &&
          (!query.sectionId || s.id === query.sectionId) &&
          (allowed === null || allowed.includes(s.id)),
      )
      .map((s) => s.id);
    const result = { range: { academicYearId: year.id, ...range }, rows: [] };
    if (!sectionIds.length) return result;

    const statuses = await this.statuses.byCode();
    const counts = groupCounts(
      await this.recordRepo.countDaysByEnrollment({ ...range, sectionIds }),
    );
    const enrollments = await this.enrollments.findByIds([...counts.keys()]);
    return {
      range: result.range,
      rows: enrollments.map((e) => ({
        enrollmentId: e.id,
        studentId: e.studentId,
        admissionNumber: e.student?.admissionNumber ?? '',
        name: e.student?.fullName ?? '',
        nameBn: e.student?.nameBn ?? null,
        rollNo: e.rollNo,
        classId: e.classId,
        className: e.schoolClass?.name ?? '',
        sectionId: e.sectionId,
        sectionName: e.section?.name ?? '',
        ...withPercentage(tallyOf(counts.get(e.id) ?? [], statuses)),
      })),
    };
  }

  private async year(id?: string): Promise<AcademicYear> {
    const year = id
      ? await this.academicYears.findById(id)
      : await this.academicYears.findCurrent();
    if (!year) {
      throw new BadRequestException({
        message: 'No academic session is marked current',
        code: 'NO_CURRENT_SESSION',
      });
    }
    return year;
  }
}

/** The register giving each section its day status (see the class doc). */
export function dayRegisters(
  registers: AttendanceRegister[],
): Map<string, AttendanceRegister> {
  const rank = (r: AttendanceRegister) =>
    r.periodId === null ? -1 : (r.period?.displayOrder ?? 0);
  const picked = new Map<string, AttendanceRegister>();
  for (const r of registers) {
    const current = picked.get(r.sectionId);
    if (!current || rank(r) < rank(current)) picked.set(r.sectionId, r);
  }
  return picked;
}

function groupCounts(counts: StatusCount[]): Map<string, StatusCount[]> {
  const grouped = new Map<string, StatusCount[]>();
  for (const c of counts) {
    if (!grouped.has(c.key)) grouped.set(c.key, []);
    grouped.get(c.key)!.push(c);
  }
  return grouped;
}

/** Status counts folded by what each status counts as. */
export function tallyOf(
  counts: StatusCount[],
  statuses: Map<string, AttendanceStatusView>,
): AttendanceTally {
  const tally = emptyTally();
  for (const c of counts) {
    addToTally(
      tally,
      statuses.get(c.statusCode)?.countsAs ?? CountsAs.PRESENT,
      c.n,
    );
  }
  return tally;
}

/** `[from, to]` inside the session, ending today at the latest. */
function clampRange(
  year: AcademicYear,
  from: string | undefined,
  to: string | undefined,
  today: string,
): { from: string; to: string } {
  const start = year.startDate ?? '0001-01-01';
  const end = year.endDate && year.endDate < today ? year.endDate : today;
  const range = {
    from: from && from > start ? from : start,
    to: to && to < end ? to : end,
  };
  if (range.to < range.from) {
    throw new BadRequestException({
      message: 'The range has no days in the session up to today',
      code: 'INVALID_DATE_RANGE',
    });
  }
  return range;
}

const cmpRow = (a: StudentAttendanceRow, b: StudentAttendanceRow) =>
  a.className.localeCompare(b.className) ||
  a.sectionName.localeCompare(b.sectionName) ||
  byRoll(a.rollNo, b.rollNo);
