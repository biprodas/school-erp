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
import { SubjectComponent } from '../enums/subject-component.enum';
import { ClassSubject } from './class-subject.entity';

/** One assessed part of a class subject, with its own full and pass marks. */
@Entity('class_subject_components')
@Index(
  'uq_class_subject_components',
  ['orgId', 'classSubjectId', 'component'],
  { unique: true },
)
export class ClassSubjectComponent extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'class_subject_id', type: 'uuid' })
  classSubjectId: string;

  @ManyToOne(() => ClassSubject, (cs) => cs.components, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'class_subject_id' })
  classSubject?: ClassSubject;

  @Column({ type: 'varchar', length: 16 })
  component: SubjectComponent;

  @Column({ name: 'full_marks', type: 'int' })
  fullMarks: number;

  @Column({ name: 'pass_marks', type: 'int', nullable: true })
  passMarks: number | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
