import { Injectable } from '@nestjs/common';
import { AttendanceRecordRepository } from '../repositories/attendance-record.repository';

/** What other modules ask before removing data attendance points at. */
@Injectable()
export class AttendanceUsageService {
  constructor(private readonly recordRepo: AttendanceRecordRepository) {}

  /** Attendance records of any of the enrollments (promotion rollback). */
  countForEnrollments(enrollmentIds: string[]): Promise<number> {
    return this.recordRepo.countForEnrollments(enrollmentIds);
  }
}
