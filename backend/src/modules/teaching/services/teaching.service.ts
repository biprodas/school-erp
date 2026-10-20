import { Injectable } from '@nestjs/common';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import { EmployeeService } from '~/modules/employees/employee.service';
import { ClassTeacherRepository } from '../repositories/class-teacher.repository';
import { SubjectTeacherRepository } from '../repositories/subject-teacher.repository';

/**
 * A class-section. Sections are still a global name list joined to classes,
 * so a section id alone doesn't identify one; per-session sections (M2)
 * reduce this to a section id.
 */
export interface ClassSectionRef {
  classId: string;
  sectionId: string;
}

/** A subject taught to a class-section (M2: a `classSubjectId`). */
export interface SubjectAssignmentRef extends ClassSectionRef {
  subjectId: string;
}

export interface TeachingAssignments {
  /** Class-sections the person is a class teacher of. */
  classSections: ClassSectionRef[];
  /** Subjects the person teaches, per class-section. */
  subjects: SubjectAssignmentRef[];
}

const NONE: TeachingAssignments = { classSections: [], subjects: [] };

/**
 * Read-only view of who teaches what, for other modules (`AccessScope`).
 * Assignments count only in the current academic year; M2 makes them
 * effective-dated (`activeAssignments(employeeId, date)`).
 */
@Injectable()
export class TeachingService {
  constructor(
    private readonly classTeacherRepo: ClassTeacherRepository,
    private readonly subjectTeacherRepo: SubjectTeacherRepository,
    private readonly employeeService: EmployeeService,
    private readonly academicYearService: AcademicYearService,
  ) {}

  /**
   * The current-session assignments of the employee linked to a user; none
   * when the user has no employee record or no session is current.
   */
  async activeAssignmentsForUser(userId: string): Promise<TeachingAssignments> {
    // Sequential on purpose: every query shares the request's QueryRunner.
    const employee = await this.employeeService.findByUserId(userId);
    if (!employee) return NONE;
    const year = await this.academicYearService.findCurrent();
    if (!year) return NONE;

    const classTeachers = await this.classTeacherRepo.findByEmployee(
      employee.id,
      year.id,
    );
    const subjectTeachers = await this.subjectTeacherRepo.findByEmployee(
      employee.id,
      year.id,
    );
    return {
      classSections: classTeachers.map(({ classId, sectionId }) => ({
        classId,
        sectionId,
      })),
      subjects: subjectTeachers.map(({ classId, sectionId, subjectId }) => ({
        classId,
        sectionId,
        subjectId,
      })),
    };
  }
}
