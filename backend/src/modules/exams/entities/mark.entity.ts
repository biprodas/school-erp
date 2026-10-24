import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { NumericColumn } from '~/shared/database/numeric-column';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';
import { StudentEnrollment } from '~/modules/enrollments/entities/student-enrollment.entity';
import { ExamSubjectComponent } from './exam-subject-component.entity';
import { MarkSheet } from './mark-sheet.entity';

/** One student's mark in one component of a mark sheet. */
@Entity('marks')
@Index(
  'uq_marks_sheet_enrollment_component',
  ['orgId', 'markSheetId', 'enrollmentId', 'componentId'],
  { unique: true },
)
@Index('idx_marks_enrollment', ['orgId', 'enrollmentId'])
export class Mark extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'mark_sheet_id', type: 'uuid' })
  markSheetId: string;

  @ManyToOne(() => MarkSheet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mark_sheet_id' })
  markSheet?: MarkSheet;

  /** An enrollment with marks can't be deleted. */
  @Column({ name: 'enrollment_id', type: 'uuid' })
  enrollmentId: string;

  @ManyToOne(() => StudentEnrollment)
  @JoinColumn({ name: 'enrollment_id' })
  enrollment?: StudentEnrollment;

  @Column({ name: 'component_id', type: 'uuid' })
  componentId: string;

  /** A component with marks can't be removed. */
  @ManyToOne(() => ExamSubjectComponent)
  @JoinColumn({ name: 'component_id' })
  component?: ExamSubjectComponent;

  /** Null when absent, exempt or not entered yet. */
  @Column({
    type: 'numeric',
    precision: 6,
    scale: 2,
    nullable: true,
    transformer: NumericColumn,
  })
  value: number | null;

  @Column({ type: 'boolean', default: false })
  absent: boolean;

  @Column({ type: 'boolean', default: false })
  exempt: boolean;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
