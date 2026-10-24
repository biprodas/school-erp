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
import { Section } from '~/modules/sections/entities/section.entity';
import { Period } from '~/modules/timetable/entities/period.entity';

/**
 * One section's attendance for one day (or one period of it, in period
 * mode). It exists once submitted; its records hold every student's
 * status.
 */
@Entity('attendance_registers')
@Index('uq_attendance_registers_day', ['orgId', 'sectionId', 'date'], {
  unique: true,
  where: `"period_id" IS NULL`,
})
@Index(
  'uq_attendance_registers_period',
  ['orgId', 'sectionId', 'date', 'periodId'],
  { unique: true, where: `"period_id" IS NOT NULL` },
)
@Index('idx_attendance_registers_org_date', ['orgId', 'date'])
export class AttendanceRegister extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** A section with registers can't be deleted. */
  @Column({ name: 'section_id', type: 'uuid' })
  sectionId: string;

  @ManyToOne(() => Section)
  @JoinColumn({ name: 'section_id' })
  section?: Section;

  /** The school-day (`YYYY-MM-DD`, school time zone). */
  @Column({ type: 'date' })
  date: string;

  /** Set in period mode only. */
  @Column({ name: 'period_id', type: 'uuid', nullable: true })
  periodId: string | null;

  @ManyToOne(() => Period, { nullable: true })
  @JoinColumn({ name: 'period_id' })
  period?: Period | null;

  /** Who submitted it first. */
  @Column({ name: 'taken_by', type: 'uuid', nullable: true })
  takenBy: string | null;

  @Column({ name: 'submitted_at', type: 'timestamptz' })
  submittedAt: Date;

  /** The client's id for its last submission (offline sync, Phase 1b). */
  @Column({
    name: 'client_request_id',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  clientRequestId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
