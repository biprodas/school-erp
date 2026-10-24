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
import { GradingSystem } from './grading-system.entity';

/** One band of a grade scale, by percentage of full marks (A+ = 80–100). */
@Entity('grade_scale_items')
@Index('uq_grade_scale_items_letter', ['orgId', 'gradingSystemId', 'letter'], {
  unique: true,
})
export class GradeScaleItem extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'grading_system_id', type: 'uuid' })
  gradingSystemId: string;

  @ManyToOne(() => GradingSystem, (s) => s.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'grading_system_id' })
  gradingSystem?: GradingSystem;

  @Column({ type: 'varchar', length: 24 })
  letter: string;

  @Column({
    name: 'min_percent',
    type: 'numeric',
    precision: 5,
    scale: 2,
    transformer: NumericColumn,
  })
  minPercent: number;

  @Column({
    name: 'max_percent',
    type: 'numeric',
    precision: 5,
    scale: 2,
    transformer: NumericColumn,
  })
  maxPercent: number;

  @Column({
    type: 'numeric',
    precision: 4,
    scale: 2,
    transformer: NumericColumn,
  })
  point: number;

  @Column({ name: 'is_fail', type: 'boolean', default: false })
  isFail: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
