import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';
import { StudentEnrollment } from '~/modules/enrollments/entities/student-enrollment.entity';
import { Student } from '~/modules/students/entities/student.entity';
import { StudentLeaveStatus } from '../enums/attendance.enum';

/**
 * A guardian's request for a student's leave (PRD 6.7), approved or
 * rejected by the class teacher. Approved days show as Leave in the
 * registers.
 */
@Entity('student_leave_requests')
@Index('idx_student_leave_requests_enrollment', [
  'orgId',
  'enrollmentId',
  'fromDate',
])
@Index('idx_student_leave_requests_status', ['orgId', 'status', 'fromDate'])
export class StudentLeaveRequest extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'enrollment_id', type: 'uuid' })
  enrollmentId: string;

  @ManyToOne(() => StudentEnrollment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'enrollment_id' })
  enrollment?: StudentEnrollment;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student?: Student;

  @Column({ name: 'from_date', type: 'date' })
  fromDate: string;

  /** Inclusive. */
  @Column({ name: 'to_date', type: 'date' })
  toDate: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ name: 'attachment_file_id', type: 'uuid', nullable: true })
  attachmentFileId: string | null;

  @Column({
    type: 'varchar',
    length: 16,
    default: StudentLeaveStatus.PENDING,
  })
  status: StudentLeaveStatus;

  /** The guardian (portal) or staff member who entered it. */
  @Column({ name: 'applied_by_user_id', type: 'uuid', nullable: true })
  appliedByUserId: string | null;

  @Column({ name: 'decided_by', type: 'uuid', nullable: true })
  decidedBy: string | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @Column({ name: 'decision_note', type: 'text', nullable: true })
  decisionNote: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
