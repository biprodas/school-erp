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
import { CorrectionSource } from '../enums/attendance.enum';
import { AttendanceRecord } from './attendance-record.entity';

/**
 * A change to a submitted record (PRD 6.7 corrections): the original
 * status, the new one, who, when and why. Never edited or deleted.
 */
@Entity('attendance_corrections')
@Index('idx_attendance_corrections_record', ['orgId', 'recordId'])
export class AttendanceCorrection extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'record_id', type: 'uuid' })
  recordId: string;

  @ManyToOne(() => AttendanceRecord, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'record_id' })
  record?: AttendanceRecord;

  @Column({ name: 'old_status', type: 'varchar', length: 16 })
  oldStatus: string;

  @Column({ name: 'new_status', type: 'varchar', length: 16 })
  newStatus: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'varchar', length: 16 })
  source: CorrectionSource;

  @Column({ name: 'changed_by', type: 'uuid', nullable: true })
  changedBy: string | null;

  @CreateDateColumn({ name: 'changed_at', type: 'timestamptz' })
  changedAt: Date;
}
