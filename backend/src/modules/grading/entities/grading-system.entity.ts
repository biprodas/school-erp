import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';
import type { GradingKind, GradingRules } from '../engine/types';
import { GradeScaleItem } from './grade-scale-item.entity';

/**
 * A school's grading system (PRD 6.9): its grade scale (`items`) and the
 * rules the engine applies. Classes use one per session (`class_grading`),
 * or the school's default.
 */
@Entity('grading_systems')
@Index('uq_grading_systems_org_name', ['orgId', 'name'], { unique: true })
@Index('uq_grading_systems_default', ['orgId'], {
  unique: true,
  where: '"is_default"',
})
export class GradingSystem extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'varchar', length: 16 })
  kind: GradingKind;

  @Column({ type: 'jsonb' })
  rules: GradingRules;

  /** The template it was made from, if any (`bd-gpa-5`, …). */
  @Column({
    name: 'template_code',
    type: 'varchar',
    length: 40,
    nullable: true,
  })
  templateCode: string | null;

  /** Used by classes without their own assignment. */
  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;

  @OneToMany(() => GradeScaleItem, (item) => item.gradingSystem)
  items?: GradeScaleItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
