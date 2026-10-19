import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';
import { JobStatus } from '../enums/job-status.enum';

/**
 * Tracks one background job (import, invoice run, PDF batch, export) so the
 * client can poll its progress. The queue holds the work; this row holds
 * what the user sees.
 */
@Entity('jobs')
@Index('idx_jobs_org_created_by', ['orgId', 'createdBy', 'createdAt'])
export class Job extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** What the job does, e.g. `students.import`. */
  @Column({ type: 'varchar', length: 64 })
  type: string;

  @Column({ type: 'varchar', length: 16, default: JobStatus.QUEUED })
  status: JobStatus;

  /** 0–100. */
  @Column({ type: 'smallint', default: 0 })
  progress: number;

  @Column({ type: 'jsonb', nullable: true })
  result: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  /** User who started it; only they (or a school admin) can read it. */
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  /** Output file, e.g. an export or a PDF bundle (see `files`). */
  @Column({ name: 'file_id', type: 'uuid', nullable: true })
  fileId: string | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
