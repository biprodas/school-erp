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
import { Section } from '~/modules/sections/entities/section.entity';
import { StudentEnrollment } from './student-enrollment.entity';

/** A transfer between sections (or shifts) of the same class (PRD 6.6). */
@Entity('enrollment_changes')
@Index('idx_enrollment_changes_enrollment', ['orgId', 'enrollmentId'])
export class EnrollmentChange extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'enrollment_id', type: 'uuid' })
  enrollmentId: string;

  @ManyToOne(() => StudentEnrollment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'enrollment_id' })
  enrollment?: StudentEnrollment;

  @Column({ name: 'from_section_id', type: 'uuid' })
  fromSectionId: string;

  @ManyToOne(() => Section, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'from_section_id' })
  fromSection?: Section;

  @Column({ name: 'to_section_id', type: 'uuid' })
  toSectionId: string;

  @ManyToOne(() => Section, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'to_section_id' })
  toSection?: Section;

  @Column({ name: 'from_roll_no', type: 'varchar', length: 40, nullable: true })
  fromRollNo: string | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'effective_date', type: 'date' })
  effectiveDate: string;

  @Column({ name: 'changed_by', type: 'uuid', nullable: true })
  changedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
