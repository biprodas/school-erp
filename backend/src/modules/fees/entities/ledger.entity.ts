import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MoneyColumn } from '~/shared/database/numeric-column';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';
import { LedgerAccount, LedgerDirection } from '../enums/fee.enum';

/** An expense category (utilities, salaries, stationery, …). */
@Entity('expense_categories')
@Index('uq_expense_categories_org_name', ['orgId', 'name'], { unique: true })
export class ExpenseCategory extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

/** A paid expense voucher. Never edited: voiding it writes a reversal. */
@Entity('expenses')
@Index('uq_expenses_org_voucher', ['orgId', 'voucherNo'], { unique: true })
@Index('idx_expenses_date', ['orgId', 'date'])
export class Expense extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'voucher_no', type: 'varchar', length: 40 })
  voucherNo: string;

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId: string;

  @ManyToOne(() => ExpenseCategory)
  @JoinColumn({ name: 'category_id' })
  category?: ExpenseCategory;

  @Column({ type: 'bigint', transformer: MoneyColumn })
  amount: number;

  @Column({ name: 'paid_from', type: 'varchar', length: 8 })
  paidFrom: LedgerAccount;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({
    name: 'attachment_file_ids',
    type: 'uuid',
    array: true,
    default: () => "'{}'",
  })
  attachmentFileIds: string[];

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'voided_at', type: 'timestamptz', nullable: true })
  voidedAt: Date | null;

  @Column({ name: 'voided_by', type: 'uuid', nullable: true })
  voidedBy: string | null;

  @Column({ name: 'void_reason', type: 'text', nullable: true })
  voidReason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

/**
 * Single-entry cash and bank ledger: one row per money movement, written
 * in the same transaction as the payment, reversal, refund or expense.
 */
@Entity('ledger_entries')
@Index('idx_ledger_entries_account_date', ['orgId', 'account', 'date'])
export class LedgerEntry extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'varchar', length: 8 })
  direction: LedgerDirection;

  @Column({ type: 'varchar', length: 8 })
  account: LedgerAccount;

  @Column({ type: 'bigint', transformer: MoneyColumn })
  amount: number;

  /** `payment`, `payment_reversal`, `refund`, `expense`, `expense_void`. */
  @Column({ name: 'source_type', type: 'varchar', length: 24 })
  sourceType: string;

  @Column({ name: 'source_id', type: 'uuid' })
  sourceId: string;

  @Column({ type: 'varchar', length: 200 })
  description: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
