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
import { StoredFile } from '~/modules/files/entities/stored-file.entity';
import type { RowError } from '~/shared/spreadsheet/spreadsheet';
import { ImportMode, ImportStatus, ImportType } from '../enums/import.enum';

/** One spreadsheet row as validated, and what committing it did. */
export interface ImportRow {
  /** Row number as the user sees it in Excel. */
  row: number;
  values: Record<string, unknown>;
  status: 'valid' | 'invalid' | 'committed' | 'skipped';
  errors: RowError[];
  /** Ids made by the commit (student, enrollment, guardians, employee). */
  result?: Record<string, unknown>;
}

export interface ImportTotals {
  rows: number;
  valid: number;
  invalid: number;
  committed?: number;
  skipped?: number;
}

/**
 * An Excel import (PRD 6.2): uploaded, validated row by row in a job
 * (preview with errors), then committed in another.
 */
@Entity('imports')
@Index('idx_imports_org_created', ['orgId', 'createdAt'])
export class ImportBatch extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 16 })
  type: ImportType;

  @Column({ name: 'file_id', type: 'uuid', nullable: true })
  fileId: string | null;

  @ManyToOne(() => StoredFile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'file_id' })
  file?: StoredFile | null;

  @Column({ type: 'varchar', length: 16, default: ImportStatus.UPLOADED })
  status: ImportStatus;

  @Column({ type: 'varchar', length: 16, default: ImportMode.ALL_OR_NOTHING })
  mode: ImportMode;

  /** Students: the session they are enrolled in. */
  @Column({ name: 'academic_year_id', type: 'uuid', nullable: true })
  academicYearId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  totals: ImportTotals | null;

  /** Every row error, for the preview (also on each row). */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  errors: RowError[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  rows: ImportRow[];

  /** Why the import failed as a whole (bad file, commit error). */
  @Column({ name: 'failure', type: 'text', nullable: true })
  failure: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'committed_at', type: 'timestamptz', nullable: true })
  committedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
