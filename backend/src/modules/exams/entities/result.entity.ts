import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { NumericColumn } from '~/shared/database/numeric-column';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';
import { StudentEnrollment } from '~/modules/enrollments/entities/student-enrollment.entity';
import { ResultDefinition } from './result-definition.entity';
import { ResultSubject } from './result-subject.entity';

const numeric = (name: string, precision: number, nullable = false) => ({
  name,
  type: 'numeric' as const,
  precision,
  scale: 2,
  nullable,
  transformer: NumericColumn,
});

/** A student's tabulated result for a definition. */
@Entity('results')
@Index(
  'uq_results_definition_enrollment',
  ['orgId', 'resultDefinitionId', 'enrollmentId'],
  {
    unique: true,
  },
)
@Index('idx_results_enrollment', ['orgId', 'enrollmentId'])
export class Result extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'result_definition_id', type: 'uuid' })
  resultDefinitionId: string;

  @ManyToOne(() => ResultDefinition, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'result_definition_id' })
  definition?: ResultDefinition;

  @Column({ name: 'enrollment_id', type: 'uuid' })
  enrollmentId: string;

  @ManyToOne(() => StudentEnrollment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'enrollment_id' })
  enrollment?: StudentEnrollment;

  /** The enrollment's section at tabulation (scope and positions). */
  @Column({ name: 'section_id', type: 'uuid' })
  sectionId: string;

  @Column(numeric('total', 8))
  total: number;

  @Column(numeric('full_marks', 8))
  fullMarks: number;

  @Column(numeric('percentage', 5))
  percentage: number;

  @Column(numeric('gpa', 4, true))
  gpa: number | null;

  @Column(numeric('gpa_without_fourth', 4, true))
  gpaWithoutFourth: number | null;

  @Column({ type: 'varchar', length: 40 })
  grade: string;

  @Column({ type: 'boolean' })
  passed: boolean;

  @Column({ name: 'failed_count', type: 'int' })
  failedCount: number;

  @Column(numeric('grace_used', 6))
  graceUsed: number;

  @Column({ name: 'position_section', type: 'int', nullable: true })
  positionSection: number | null;

  @Column({ name: 'position_class', type: 'int', nullable: true })
  positionClass: number | null;

  /** The class teacher's remarks; kept across tabulations. */
  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @Column({ name: 'remarks_by', type: 'uuid', nullable: true })
  remarksBy: string | null;

  /** The student's last report card PDF. */
  @Column({ name: 'report_card_file_id', type: 'uuid', nullable: true })
  reportCardFileId: string | null;

  @Column({ name: 'computed_at', type: 'timestamptz' })
  computedAt: Date;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @OneToMany(() => ResultSubject, (s) => s.result)
  subjects?: ResultSubject[];
}
