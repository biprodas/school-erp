import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { PlanLimits } from '../plans.catalog';

const bigintNumber = {
  to: (value: number) => value,
  from: (value: string | null) => (value === null ? 0 : Number(value)),
};

/**
 * A subscription plan (PRD 3.3, 6.1). Platform table, read through the root
 * connection; not org-scoped. Money is in minor units (poisha).
 */
@Entity('plans', { schema: 'public' })
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** `free`, `basic`, `standard`, `premium`. */
  @Column({ type: 'varchar', length: 32, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({
    name: 'price_per_student',
    type: 'bigint',
    default: 0,
    transformer: bigintNumber,
  })
  pricePerStudent: number;

  @Column({
    name: 'min_fee',
    type: 'bigint',
    default: 0,
    transformer: bigintNumber,
  })
  minFee: number;

  @Column({ type: 'varchar', length: 3, default: 'BDT' })
  currency: string;

  /** Module keys (`plans.catalog.ts`). */
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  modules: string[];

  @Column({ type: 'jsonb' })
  limits: PlanLimits;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
