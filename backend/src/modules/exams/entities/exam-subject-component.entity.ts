import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';
import { ExamSubject } from './exam-subject.entity';

/** One assessed part of an exam subject (CQ, MCQ, practical, …). */
@Entity('exam_subject_components')
@Index('uq_exam_subject_components', ['orgId', 'examSubjectId', 'component'], {
  unique: true,
})
export class ExamSubjectComponent extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'exam_subject_id', type: 'uuid' })
  examSubjectId: string;

  @ManyToOne(() => ExamSubject, (s) => s.components, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exam_subject_id' })
  examSubject?: ExamSubject;

  /** `cq`, `mcq`, `practical`, `written` or `oral`. */
  @Column({ type: 'varchar', length: 16 })
  component: string;

  @Column({ name: 'full_marks', type: 'int' })
  fullMarks: number;

  @Column({ name: 'pass_marks', type: 'int', nullable: true })
  passMarks: number | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
