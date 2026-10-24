import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MoneyColumn } from '~/shared/database/numeric-column';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';
import { FineKind } from '../enums/fee.enum';
import { FeeHead } from './fee-head.entity';

/** A late fine (PRD 6.10): fixed or per day after a grace period. */
@Entity('late_fine_rules')
export class LateFineRule extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  /** Invoices with a line of this head; null = every invoice. */
  @Column({ name: 'fee_head_id', type: 'uuid', nullable: true })
  feeHeadId: string | null;

  @ManyToOne(() => FeeHead, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fee_head_id' })
  feeHead?: FeeHead | null;

  @Column({ type: 'varchar', length: 16 })
  kind: FineKind;

  @Column({ type: 'bigint', transformer: MoneyColumn })
  amount: number;

  /** Days after the due date; null = `fees.graceDays`. */
  @Column({ name: 'grace_days', type: 'int', nullable: true })
  graceDays: number | null;

  @Column({
    name: 'max_amount',
    type: 'bigint',
    nullable: true,
    transformer: MoneyColumn,
  })
  maxAmount: number | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
