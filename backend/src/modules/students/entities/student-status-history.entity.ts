import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';
import { Student } from './student.entity';

/** One status change of a student, with why and from when (PRD 6.6). */
@Entity('student_status_history')
@Index('idx_student_status_history_student', ['orgId', 'studentId'])
export class StudentStatusHistory extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student?: Student;

  @Column({ name: 'from_status', type: 'varchar', length: 16 })
  fromStatus: string;

  @Column({ name: 'to_status', type: 'varchar', length: 16 })
  toStatus: string;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'effective_date', type: 'date' })
  effectiveDate: string;

  @Column({ name: 'changed_by', type: 'uuid', nullable: true })
  changedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
