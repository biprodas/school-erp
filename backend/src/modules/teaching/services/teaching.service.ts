import { Injectable } from '@nestjs/common';
import { EmployeeService } from '~/modules/employees/employee.service';
import { SettingsService } from '~/modules/settings/services/settings.service';
import { ClassTeacher } from '../entities/class-teacher.entity';
import { SubjectTeacher } from '../entities/subject-teacher.entity';
import { ClassTeacherRepository } from '../repositories/class-teacher.repository';
import { SubjectTeacherRepository } from '../repositories/subject-teacher.repository';
import { ASSIGNABLE_STATUSES } from './assignment-rules';

/** A class subject taught in a section. */
export interface SubjectAssignmentRef {
  sectionId: string;
  classSubjectId: string;
}

export interface TeachingAssignments {
  /** Sections the person is a class teacher of. */
  sections: string[];
  /** Subjects the person teaches, per section. */
  subjects: SubjectAssignmentRef[];
}

/** What a rollover copied, per kind. */
export interface TeacherCopyResult {
  classTeachers: { created: number; skipped: number };
  subjectTeachers: { created: number; skipped: number };
}

/** A fresh empty result, so callers can't mutate a shared one. */
const noAssignments = (): TeachingAssignments => ({
  sections: [],
  subjects: [],
});

/**
 * Read-only view of who teaches what, for other modules (`AccessScope`,
 * later attendance and marks), plus the rollover copy. Assignments are
 * effective-dated: "active on a day" means started on or before it and not
 * ended before it.
 */
@Injectable()
export class TeachingService {
  constructor(
    private readonly classTeacherRepo: ClassTeacherRepository,
    private readonly subjectTeacherRepo: SubjectTeacherRepository,
    private readonly employeeService: EmployeeService,
    private readonly settings: SettingsService,
  ) {}

  /** An employee's assignments in effect on `date` (`YYYY-MM-DD`). */
  async activeAssignments(
    employeeId: string,
    date: string,
  ): Promise<TeachingAssignments> {
    // Sequential on purpose: every query shares the request's QueryRunner.
    const classTeachers = await this.classTeacherRepo.findActiveForEmployee(
      employeeId,
      date,
    );
    const subjectTeachers = await this.subjectTeacherRepo.findActiveForEmployee(
      employeeId,
      date,
    );
    return {
      sections: [...new Set(classTeachers.map((ct) => ct.sectionId))],
      subjects: subjectTeachers.map(({ sectionId, classSubjectId }) => ({
        sectionId,
        classSubjectId,
      })),
    };
  }

  /**
   * Today's assignments (school time zone) of the employee linked to a
   * user; none when the user has no employee record.
   */
  async activeAssignmentsForUser(userId: string): Promise<TeachingAssignments> {
    const employee = await this.employeeService.findByUserId(userId);
    if (!employee) return noAssignments();
    return this.activeAssignments(employee.id, await this.settings.today());
  }

  /** Who taught a class subject in a section on a (past) day. */
  assignmentOn(
    sectionId: string,
    classSubjectId: string,
    date: string,
  ): Promise<SubjectTeacher[]> {
    return this.subjectTeacherRepo.findActiveFor(
      sectionId,
      classSubjectId,
      date,
    );
  }

  /** Accounts of the sections' class teachers today (notice recipients). */
  async classTeacherUserIds(sectionIds: string[]): Promise<string[]> {
    const today = await this.settings.today();
    const ids = new Set<string>();
    for (const sectionId of sectionIds) {
      for (const ct of await this.classTeacherRepo.findActiveInSection(
        sectionId,
        today,
      )) {
        if (ct.employee?.userId) ids.add(ct.employee.userId);
      }
    }
    return [...ids];
  }

  /** The section's class teachers on a day. */
  classTeachersOn(sectionId: string, date: string): Promise<ClassTeacher[]> {
    return this.classTeacherRepo.findActiveInSection(sectionId, date);
  }

  /** Assignment rows (current or ended) in a session's sections. */
  async countInYear(academicYearId: string): Promise<number> {
    return (
      (await this.classTeacherRepo.countInYear(academicYearId)) +
      (await this.subjectTeacherRepo.countInYear(academicYearId))
    );
  }

  /**
   * Session rollover: opens, from `effectiveFrom`, a copy of every current
   * assignment of `fromYearId` in the matching target section (and class
   * subject). Skipped: rows whose section or subject wasn't copied, staff
   * who are no longer active, and (merge) assignments that already exist.
   * A copied primary class teacher stays primary unless the target section
   * already has one. Call inside the caller's transaction.
   */
  async copyToYear(input: {
    fromYearId: string;
    sectionIds: Map<string, string>;
    classSubjectIds: Map<string, string>;
    effectiveFrom: string;
  }): Promise<TeacherCopyResult> {
    const result: TeacherCopyResult = {
      classTeachers: { created: 0, skipped: 0 },
      subjectTeachers: { created: 0, skipped: 0 },
    };
    const active = (row: { employee?: { status: string } }) =>
      !!row.employee && ASSIGNABLE_STATUSES.includes(row.employee.status);

    const primaries = new Set<string>();
    for (const row of await this.classTeacherRepo.findCurrentInYear(
      input.fromYearId,
    )) {
      const sectionId = input.sectionIds.get(row.sectionId);
      if (
        !sectionId ||
        !active(row) ||
        (await this.classTeacherRepo.findCurrent(sectionId, row.employeeId))
      ) {
        result.classTeachers.skipped++;
        continue;
      }
      const isPrimary =
        row.isPrimary &&
        !primaries.has(sectionId) &&
        !(await this.classTeacherRepo.findCurrentPrimary(sectionId));
      if (isPrimary) primaries.add(sectionId);
      await this.classTeacherRepo.saveNew({
        sectionId,
        employeeId: row.employeeId,
        isPrimary,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: null,
      });
      result.classTeachers.created++;
    }

    for (const row of await this.subjectTeacherRepo.findCurrentInYear(
      input.fromYearId,
    )) {
      const sectionId = input.sectionIds.get(row.sectionId);
      const classSubjectId = input.classSubjectIds.get(row.classSubjectId);
      if (
        !sectionId ||
        !classSubjectId ||
        !active(row) ||
        (await this.subjectTeacherRepo.findCurrent(
          sectionId,
          classSubjectId,
          row.employeeId,
        ))
      ) {
        result.subjectTeachers.skipped++;
        continue;
      }
      await this.subjectTeacherRepo.saveNew({
        sectionId,
        classSubjectId,
        employeeId: row.employeeId,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: null,
      });
      result.subjectTeachers.created++;
    }
    return result;
  }
}
