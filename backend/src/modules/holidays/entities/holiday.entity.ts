import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';
import { HolidayType } from '../enums/holiday-type.enum';

/**
 * A day or run of days without classes (PRD 6.7): for the whole school, or
 * only some classes. Attendance can't be taken on them.
 */
@Entity('holidays')
@Index('uq_holidays_org_name_from', ['orgId', 'name', 'dateFrom'], {
  unique: true,
})
@Index('idx_holidays_org_dates', ['orgId', 'dateFrom', 'dateTo'])
export class Holiday extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ name: 'name_bn', type: 'varchar', length: 120, nullable: true })
  nameBn: string | null;

  @Column({ type: 'varchar', length: 16 })
  type: HolidayType;

  @Column({ name: 'date_from', type: 'date' })
  dateFrom: string;

  /** Inclusive; equal to `dateFrom` for one day. */
  @Column({ name: 'date_to', type: 'date' })
  dateTo: string;

  /** Classes it applies to; empty = the whole school. */
  @Column({
    name: 'class_ids',
    type: 'uuid',
    array: true,
    default: () => "'{}'",
  })
  classIds: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
