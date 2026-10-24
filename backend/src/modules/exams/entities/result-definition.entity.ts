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
import { AcademicYear } from '~/modules/academic-years/entities/academic-year.entity';
import { Class } from '~/modules/classes/entities/class.entity';
import { Exam } from './exam.entity';

export interface ResultDefinitionItem {
  examId: string;
  /** Share of the combined result (weights are normalized). */
  weight: number;
}

/**
 * Which exams make up a class's result, and with what weights: one exam
 * (made automatically when the exam opens, `examId` set) or a combined
 * session result such as 30% half-yearly + 70% annual. Results are
 * tabulated and published per definition.
 */
@Entity('result_definitions')
@Index(
  'uq_result_definitions_name',
  ['orgId', 'academicYearId', 'classId', 'name'],
  {
    unique: true,
  },
)
@Index('uq_result_definitions_exam', ['orgId', 'examId', 'classId'], {
  unique: true,
  where: '"exam_id" IS NOT NULL',
})
export class ResultDefinition extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'academic_year_id', type: 'uuid' })
  academicYearId: string;

  @ManyToOne(() => AcademicYear, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'academic_year_id' })
  academicYear?: AcademicYear;

  @Column({ name: 'class_id', type: 'uuid' })
  classId: string;

  @ManyToOne(() => Class, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  schoolClass?: Class;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'jsonb' })
  items: ResultDefinitionItem[];

  /** Set on a single exam's own definition. */
  @Column({ name: 'exam_id', type: 'uuid', nullable: true })
  examId: string | null;

  @ManyToOne(() => Exam, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exam_id' })
  exam?: Exam | null;

  /** When the last tabulation started. */
  @Column({ name: 'computed_at', type: 'timestamptz', nullable: true })
  computedAt: Date | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ name: 'published_by', type: 'uuid', nullable: true })
  publishedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
