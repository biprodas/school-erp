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
import { AcademicYear } from '~/modules/academic-years/entities/academic-year.entity';
import { Class } from '~/modules/classes/entities/class.entity';
import { PromotionBatchStatus, RollBy } from '../enums/promotion.enum';
import { PromotionBatchItem } from './promotion-batch-item.entity';

export interface PromotionOptions {
  rollBy: RollBy;
  /** Spread students over the target sections instead of same-name ones. */
  shuffleSections: boolean;
  /** Rows moved from the old `student_promotions` (no items to commit). */
  legacy?: boolean;
}

/**
 * Promotion of one class from one session to the next (PRD 6.6): a draft
 * with one item per student to preview and adjust, then committed in one
 * go, and reversible for 24 hours.
 */
@Entity('promotion_batches')
// One live batch per class and session (a rolled-back one can be redone).
@Index('uq_promotion_batches_live', ['orgId', 'fromYearId', 'classId'], {
  unique: true,
  where: `"status" IN ('draft', 'committed')`,
})
export class PromotionBatch extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'from_year_id', type: 'uuid' })
  fromYearId: string;

  @ManyToOne(() => AcademicYear, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'from_year_id' })
  fromYear?: AcademicYear;

  @Column({ name: 'to_year_id', type: 'uuid' })
  toYearId: string;

  @ManyToOne(() => AcademicYear, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'to_year_id' })
  toYear?: AcademicYear;

  @Column({ name: 'class_id', type: 'uuid' })
  classId: string;

  @ManyToOne(() => Class, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  schoolClass?: Class;

  @Column({
    type: 'varchar',
    length: 16,
    default: PromotionBatchStatus.DRAFT,
  })
  status: PromotionBatchStatus;

  @Column({ type: 'jsonb' })
  options: PromotionOptions;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'committed_at', type: 'timestamptz', nullable: true })
  committedAt: Date | null;

  @Column({ name: 'committed_by', type: 'uuid', nullable: true })
  committedBy: string | null;

  @Column({ name: 'rolled_back_at', type: 'timestamptz', nullable: true })
  rolledBackAt: Date | null;

  @Column({ name: 'rolled_back_by', type: 'uuid', nullable: true })
  rolledBackBy: string | null;

  @OneToMany(() => PromotionBatchItem, (item) => item.batch)
  items?: PromotionBatchItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
