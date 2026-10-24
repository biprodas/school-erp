import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';
import { ClassSubject } from '~/modules/class-curriculum/entities/class-subject.entity';
import { Exam } from './exam.entity';
import { ExamSubjectComponent } from './exam-subject-component.entity';

/**
 * A class subject sat in an exam, with this exam's full and pass marks.
 * Copied from the class subject when attached; editable until marks exist.
 */
@Entity('exam_subjects')
@Index('uq_exam_subjects', ['orgId', 'examId', 'classSubjectId'], {
  unique: true,
})
@Index('idx_exam_subjects_class', ['orgId', 'examId', 'classId'])
export class ExamSubject extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'exam_id', type: 'uuid' })
  examId: string;

  @ManyToOne(() => Exam, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exam_id' })
  exam?: Exam;

  /** A class subject sat in an exam can't be deleted. */
  @Column({ name: 'class_subject_id', type: 'uuid' })
  classSubjectId: string;

  @ManyToOne(() => ClassSubject)
  @JoinColumn({ name: 'class_subject_id' })
  classSubject?: ClassSubject;

  /** The class subject's class, for per-class queries. */
  @Column({ name: 'class_id', type: 'uuid' })
  classId: string;

  /** Sum of the components' full marks. */
  @Column({ name: 'full_marks', type: 'int' })
  fullMarks: number;

  /** Pass mark on the total; null = the grade scale's pass band. */
  @Column({ name: 'pass_marks', type: 'int', nullable: true })
  passMarks: number | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @OneToMany(() => ExamSubjectComponent, (c) => c.examSubject)
  components?: ExamSubjectComponent[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
