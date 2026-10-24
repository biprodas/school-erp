import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { NumericColumn } from '~/shared/database/numeric-column';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';
import { ClassSubject } from '~/modules/class-curriculum/entities/class-subject.entity';
import type { ComponentResult } from '~/modules/grading/engine/types';
import { Result } from './result.entity';

/** One subject of a student's result. */
@Entity('result_subjects')
@Index('uq_result_subjects', ['orgId', 'resultId', 'classSubjectId'], {
  unique: true,
})
export class ResultSubject extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'result_id', type: 'uuid' })
  resultId: string;

  @ManyToOne(() => Result, (r) => r.subjects, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'result_id' })
  result?: Result;

  @Column({ name: 'class_subject_id', type: 'uuid' })
  classSubjectId: string;

  @ManyToOne(() => ClassSubject)
  @JoinColumn({ name: 'class_subject_id' })
  classSubject?: ClassSubject;

  @Column({
    type: 'numeric',
    precision: 7,
    scale: 2,
    transformer: NumericColumn,
  })
  marks: number;

  @Column({
    name: 'full_marks',
    type: 'numeric',
    precision: 7,
    scale: 2,
    transformer: NumericColumn,
  })
  fullMarks: number;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    transformer: NumericColumn,
  })
  percentage: number;

  @Column({ type: 'varchar', length: 24, nullable: true })
  grade: string | null;

  @Column({
    type: 'numeric',
    precision: 4,
    scale: 2,
    nullable: true,
    transformer: NumericColumn,
  })
  point: number | null;

  @Column({ type: 'boolean' })
  passed: boolean;

  @Column({ type: 'boolean', default: false })
  absent: boolean;

  @Column({ type: 'boolean', default: false })
  exempt: boolean;

  @Column({ name: 'is_fourth', type: 'boolean', default: false })
  isFourth: boolean;

  @Column({
    type: 'numeric',
    precision: 6,
    scale: 2,
    default: 0,
    transformer: NumericColumn,
  })
  grace: number;

  /** Per-component marks, for report cards. */
  @Column({ type: 'jsonb' })
  components: ComponentResult[];
}
