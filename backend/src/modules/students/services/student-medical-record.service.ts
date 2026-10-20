import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '~/modules/audit/services/audit.service';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';
import { UpsertStudentMedicalRecordDto } from '../dto/upsert-student-medical-record.dto';
import { StudentMedicalRecord } from '../entities/student-medical-record.entity';
import { StudentMedicalRecordRepository } from '../repositories/student-medical-record.repository';
import { StudentService } from './student.service';

@Injectable()
export class StudentMedicalRecordService {
  constructor(
    private readonly medicalRepo: StudentMedicalRecordRepository,
    private readonly studentService: StudentService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Returns the student's medical profile, or null if none recorded yet.
   * Reading health data is audited (PRD 6.3); the row names the student,
   * never the data.
   */
  async getForStudent(studentId: string): Promise<StudentMedicalRecord | null> {
    await this.studentService.findById(studentId);
    const record = await this.medicalRepo.findByStudent(studentId);
    if (record) {
      await this.audit.record({
        action: AUDIT_ACTIONS.STUDENT_MEDICAL_VIEWED,
        entityType: 'student',
        entityId: studentId,
      });
    }
    return record;
  }

  /** Creates the record on first write, updates it thereafter. */
  async upsert(
    studentId: string,
    dto: UpsertStudentMedicalRecordDto,
  ): Promise<StudentMedicalRecord> {
    await this.studentService.findById(studentId);

    const existing = await this.medicalRepo.findByStudent(studentId);
    if (existing) {
      Object.assign(existing, dto);
      return this.medicalRepo.save(existing);
    }

    return this.medicalRepo.saveNew({ studentId, ...dto });
  }

  async remove(studentId: string): Promise<void> {
    const existing = await this.medicalRepo.findByStudent(studentId);
    if (!existing) {
      throw new NotFoundException(
        `No medical record found for student "${studentId}"`,
      );
    }
    await this.medicalRepo.deleteById(existing.id);
  }
}
