import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { NumericColumn } from '~/shared/database/numeric-column';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';

/** A kind of exam (class test, half-yearly, annual, …) with its usual weight. */
@Entity('exam_types')
@Index('uq_exam_types_org_name', ['orgId', 'name'], { unique: true })
export class ExamType extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  /** Weight new exams of this type start with in a combined result. */
  @Column({
    name: 'default_weight',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 100,
    transformer: NumericColumn,
  })
  defaultWeight: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
