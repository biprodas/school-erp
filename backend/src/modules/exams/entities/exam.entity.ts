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
import { NumericColumn } from '~/shared/database/numeric-column';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';
import { AcademicYear } from '~/modules/academic-years/entities/academic-year.entity';
import { Term } from '~/modules/terms/entities/term.entity';
import { ExamStatus } from '../enums/exam.enum';
import { ExamType } from './exam-type.entity';

/** An exam of a session (PRD 6.9), sat by the classes of its subjects. */
@Entity('exams')
@Index('uq_exams_org_year_name', ['orgId', 'academicYearId', 'name'], {
  unique: true,
})
export class Exam extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'academic_year_id', type: 'uuid' })
  academicYearId: string;

  @ManyToOne(() => AcademicYear, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'academic_year_id' })
  academicYear?: AcademicYear;

  @Column({ name: 'term_id', type: 'uuid', nullable: true })
  termId: string | null;

  @ManyToOne(() => Term, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'term_id' })
  term?: Term | null;

  @Column({ name: 'exam_type_id', type: 'uuid', nullable: true })
  examTypeId: string | null;

  @ManyToOne(() => ExamType, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'exam_type_id' })
  examType?: ExamType | null;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  /** Default weight in combined results (a definition may override it). */
  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 100,
    transformer: NumericColumn,
  })
  weight: number;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: string | null;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  @Column({ type: 'varchar', length: 16, default: ExamStatus.DRAFT })
  status: ExamStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
