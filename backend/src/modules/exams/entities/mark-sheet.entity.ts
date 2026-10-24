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
import { Section } from '~/modules/sections/entities/section.entity';
import { MarkSheetStatus } from '../enums/exam.enum';
import { ExamSubject } from './exam-subject.entity';

/** One exam subject's marks for one section, and where they are in the workflow. */
@Entity('mark_sheets')
@Index('uq_mark_sheets', ['orgId', 'examSubjectId', 'sectionId'], {
  unique: true,
})
export class MarkSheet extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'exam_subject_id', type: 'uuid' })
  examSubjectId: string;

  @ManyToOne(() => ExamSubject, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exam_subject_id' })
  examSubject?: ExamSubject;

  /** A section with mark sheets can't be deleted. */
  @Column({ name: 'section_id', type: 'uuid' })
  sectionId: string;

  @ManyToOne(() => Section)
  @JoinColumn({ name: 'section_id' })
  section?: Section;

  @Column({ type: 'varchar', length: 16, default: MarkSheetStatus.DRAFT })
  status: MarkSheetStatus;

  /** Set on the first submit; later mark changes are audited. */
  @Column({ name: 'first_submitted_at', type: 'timestamptz', nullable: true })
  firstSubmittedAt: Date | null;

  @Column({ name: 'submitted_by', type: 'uuid', nullable: true })
  submittedBy: string | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'verified_by', type: 'uuid', nullable: true })
  verifiedBy: string | null;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string | null;

  /** Cleared on reopen; results tabulated before it are out of date. */
  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'reopened_by', type: 'uuid', nullable: true })
  reopenedBy: string | null;

  @Column({ name: 'reopened_at', type: 'timestamptz', nullable: true })
  reopenedAt: Date | null;

  @Column({ name: 'reopen_reason', type: 'text', nullable: true })
  reopenReason: string | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
