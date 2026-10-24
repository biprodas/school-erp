import { Injectable } from '@nestjs/common';
import { AttendanceReportService } from '~/modules/attendance/services/attendance-report.service';
import { ResultService } from '~/modules/exams/services/result.service';
import { EnrollmentService } from '~/modules/enrollments/services/enrollment.service';
import { StudentEnrollmentStatus } from '~/modules/enrollments/enums/student-enrollment-status.enum';
import { GuardianService } from '~/modules/guardians/services/guardian.service';
import { StudentDocumentService } from '~/modules/students/services/student-document.service';
import { StudentMedicalRecordService } from '~/modules/students/services/student-medical-record.service';
import { StudentNoteService } from '~/modules/students/services/student-note.service';
import { StudentService } from '~/modules/students/services/student.service';

/** What the caller may see in the 360 view. */
export interface OverviewAccess {
  medical: boolean;
  documents: boolean;
  notes: boolean;
  sensitiveNotes: boolean;
  guardians: boolean;
  attendance: boolean;
  results: boolean;
}

/**
 * The student 360 view (PRD 6.6): profile, current placement, enrollment
 * history, guardians, documents and notes at a glance. Health shows only
 * with `student_medical:read` (and is audited like any health read).
 * Attendance shows the current session so far (with `attendance:read`),
 * results the published ones (with `results:read`); fees join with M6.
 */
@Injectable()
export class StudentOverviewService {
  constructor(
    private readonly students: StudentService,
    private readonly enrollments: EnrollmentService,
    private readonly guardians: GuardianService,
    private readonly medical: StudentMedicalRecordService,
    private readonly documents: StudentDocumentService,
    private readonly notes: StudentNoteService,
    private readonly attendance: AttendanceReportService,
    private readonly results: ResultService,
  ) {}

  async overview(studentId: string, access: OverviewAccess) {
    // Sequential on purpose: every query shares the request's QueryRunner.
    const student = await this.students.findById(studentId);
    const photoUrl = await this.students.photoUrl(student);
    const history = await this.enrollments.findForStudent(studentId);
    const current =
      history.find((e) => e.academicYear?.isCurrent) ??
      history.find((e) => e.status === StudentEnrollmentStatus.ACTIVE) ??
      null;
    return {
      profile: Object.assign(student, { photoUrl }),
      currentEnrollment: current,
      enrollments: history,
      statusHistory: await this.students.statusHistory(studentId),
      guardians: access.guardians
        ? await this.guardians.listForStudent(studentId)
        : null,
      medical: access.medical
        ? await this.medical.getForStudent(studentId)
        : null,
      documents: access.documents
        ? { count: await this.documents.countForStudent(studentId) }
        : null,
      notes: access.notes
        ? {
            count: await this.notes.countVisible(
              studentId,
              access.sensitiveNotes,
            ),
          }
        : null,
      attendance:
        access.attendance && current
          ? await this.attendance.enrollmentSummary(current.id)
          : null,
      results: access.results
        ? await this.results.publishedFor(history.map((e) => e.id))
        : null,
      // Filled in by fees (M6).
      fees: null,
    };
  }
}
