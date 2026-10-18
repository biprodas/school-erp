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
import { Subject } from '~/modules/subjects/entities/subject.entity';
import { SubjectGroup } from './subject-group.entity';

/** Membership of a {@link Subject} in a {@link SubjectGroup}. */
@Entity('subject_group_subjects')
@Index('uq_subject_group_subject', ['orgId', 'subjectGroupId', 'subjectId'], {
  unique: true,
})
export class SubjectGroupSubject extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'subject_group_id', type: 'uuid' })
  subjectGroupId: string;

  @ManyToOne(() => SubjectGroup, (group) => group.subjectLinks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'subject_group_id' })
  subjectGroup: SubjectGroup;

  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  @ManyToOne(() => Subject, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subject_id' })
  subject: Subject;

  @Column({ name: 'is_compulsory', type: 'boolean', default: true })
  isCompulsory: boolean;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
