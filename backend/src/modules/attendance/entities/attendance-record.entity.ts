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
import { AttendanceRegister } from './attendance-register.entity';

/** One student's status in a register. */
@Entity('attendance_records')
@Index(
  'uq_attendance_records_register_enrollment',
  ['orgId', 'registerId', 'enrollmentId'],
  { unique: true },
)
@Index('idx_attendance_records_enrollment', ['orgId', 'enrollmentId'])
export class AttendanceRecord extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'register_id', type: 'uuid' })
  registerId: string;

  @ManyToOne(() => AttendanceRegister, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'register_id' })
  register?: AttendanceRegister;

  /** An enrollment with records can't be deleted. */
  @Column({ name: 'enrollment_id', type: 'uuid' })
  enrollmentId: string;

  @ManyToOne(() => StudentEnrollment)
  @JoinColumn({ name: 'enrollment_id' })
  enrollment?: StudentEnrollment;

  /** A system or custom status code. */
  @Column({ name: 'status_code', type: 'varchar', length: 16 })
  statusCode: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  remark: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
