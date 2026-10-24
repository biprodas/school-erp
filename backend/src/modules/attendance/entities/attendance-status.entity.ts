import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';
import { CountsAs } from '../enums/attendance.enum';

/**
 * A school's own attendance status (PRD 6.7 "custom statuses"), e.g.
 * "Sick". `countsAs` folds it into the counts and percentages. The five
 * system statuses are code-defined (`SYSTEM_STATUSES`) and not stored.
 */
@Entity('attendance_statuses')
@Index('uq_attendance_statuses_org_code', ['orgId', 'code'], { unique: true })
export class AttendanceStatus extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Stored on records; fixed once created. */
  @Column({ type: 'varchar', length: 16 })
  code: string;

  @Column({ name: 'label_en', type: 'varchar', length: 60 })
  labelEn: string;

  @Column({ name: 'label_bn', type: 'varchar', length: 60 })
  labelBn: string;

  @Column({ name: 'counts_as', type: 'varchar', length: 16 })
  countsAs: CountsAs;

  @Column({ type: 'varchar', length: 3 })
  symbol: string;

  @Column({ name: 'sort_order', type: 'int', default: 100 })
  sortOrder: number;

  /** Inactive statuses stay on old records but can't be given any more. */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
