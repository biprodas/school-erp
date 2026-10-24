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
import { MoneyColumn } from '~/shared/database/numeric-column';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';
import {
  AdjustmentType,
  ApprovalStatus,
  LedgerAccount,
} from '../enums/fee.enum';
import { InvoiceLine } from './invoice.entity';

/**
 * A refund, waiver or correction on an invoice line (PRD 6.10). Balances
 * change only once approved; the record stays as the audit trail.
 */
@Entity('adjustments')
@Index('idx_adjustments_status', ['orgId', 'status'])
export class Adjustment extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 16 })
  type: AdjustmentType;

  @Column({ name: 'invoice_line_id', type: 'uuid' })
  invoiceLineId: string;

  @ManyToOne(() => InvoiceLine)
  @JoinColumn({ name: 'invoice_line_id' })
  invoiceLine?: InvoiceLine;

  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId: string;

  /** Refunds and waivers are positive; a correction may be negative. */
  @Column({ type: 'bigint', transformer: MoneyColumn })
  amount: number;

  /** Refunds: where the money is paid back from. */
  @Column({ name: 'paid_from', type: 'varchar', length: 8, nullable: true })
  paidFrom: LedgerAccount | null;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'varchar', length: 16, default: ApprovalStatus.PENDING })
  status: ApprovalStatus;

  @Column({ name: 'requested_by', type: 'uuid', nullable: true })
  requestedBy: string | null;

  @Column({ name: 'decided_by', type: 'uuid', nullable: true })
  decidedBy: string | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @Column({ name: 'decision_note', type: 'text', nullable: true })
  decisionNote: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
