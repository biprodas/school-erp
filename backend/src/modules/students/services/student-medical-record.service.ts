import { Injectable, NotFoundException } from '@nestjs/common';
import { UpsertStudentMedicalRecordDto } from '../dto/upsert-student-medical-record.dto';
import { StudentMedicalRecord } from '../entities/student-medical-record.entity';
import { StudentMedicalRecordRepository } from '../repositories/student-medical-record.repository';
import { StudentService } from './student.service';

@Injectable()
export class StudentMedicalRecordService {
  constructor(
    private readonly medicalRepo: StudentMedicalRecordRepository,
    private readonly studentService: StudentService,
  ) {}

  /** Returns the student's medical profile, or null if none recorded yet. */
  async getForStudent(studentId: string): Promise<StudentMedicalRecord | null> {
    await this.studentService.findById(studentId);
    return this.medicalRepo.findByStudent(studentId);
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
