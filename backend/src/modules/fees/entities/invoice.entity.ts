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
import { MoneyColumn } from '~/shared/database/numeric-column';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';
import { StudentEnrollment } from '~/modules/enrollments/entities/student-enrollment.entity';
import { Student } from '~/modules/students/entities/student.entity';
import { InvoiceKind, InvoiceLineKind, InvoiceStatus } from '../enums/fee.enum';
import { FeeHead } from './fee-head.entity';
import { LateFineRule } from './late-fine-rule.entity';

const money = (name: string) => ({
  name,
  type: 'bigint' as const,
  default: 0,
  transformer: MoneyColumn,
});

/**
 * A student's bill (PRD 6.10). Totals are cached from its lines and only
 * written inside the transaction that changes them (billing, allocation,
 * adjustment); the nightly check recomputes them and reports drift.
 */
@Entity('invoices')
@Index('uq_invoices_org_number', ['orgId', 'number'], { unique: true })
@Index('uq_invoices_org_bank_reference', ['orgId', 'bankReference'], {
  unique: true,
})
@Index('uq_invoices_generated_period', ['orgId', 'enrollmentId', 'period'], {
  unique: true,
  where: `"kind" = 'generated' AND "status" <> 'cancelled'`,
})
@Index('idx_invoices_student', ['orgId', 'studentId', 'dueDate'])
@Index('idx_invoices_open_due', ['orgId', 'status', 'dueDate'])
export class Invoice extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 40 })
  number: string;

  @Column({ type: 'varchar', length: 16 })
  kind: InvoiceKind;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student?: Student;

  /** An enrollment with invoices can't be deleted. */
  @Column({ name: 'enrollment_id', type: 'uuid' })
  enrollmentId: string;

  @ManyToOne(() => StudentEnrollment)
  @JoinColumn({ name: 'enrollment_id' })
  enrollment?: StudentEnrollment;

  /** `YYYY-MM` billed (ad hoc invoices: the month issued). */
  @Column({ type: 'varchar', length: 7 })
  period: string;

  @Column({ name: 'issue_date', type: 'date' })
  issueDate: string;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  @Column({ type: 'varchar', length: 16, default: InvoiceStatus.OPEN })
  status: InvoiceStatus;

  @Column(money('total'))
  total: number;

  @Column(money('discount_total'))
  discountTotal: number;

  @Column(money('fine_total'))
  fineTotal: number;

  @Column(money('net_total'))
  netTotal: number;

  @Column(money('adjusted_total'))
  adjustedTotal: number;

  @Column(money('allocated_total'))
  allocatedTotal: number;

  @Column(money('refunded_total'))
  refundedTotal: number;

  /** Quoted on bank deposit slips (partner-bank collection, 1b). */
  @Column({ name: 'bank_reference', type: 'varchar', length: 24 })
  bankReference: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  /** Due reminders sent so far (`fees.reminderDays`). */
  @Column({ name: 'reminders_sent', type: 'int', default: 0 })
  remindersSent: number;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @Column({ name: 'cancelled_by', type: 'uuid', nullable: true })
  cancelledBy: string | null;

  @Column({ name: 'cancel_reason', type: 'text', nullable: true })
  cancelReason: string | null;

  @OneToMany(() => InvoiceLine, (l) => l.invoice)
  lines?: InvoiceLine[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

/** One charge on an invoice; outstanding = net − adjusted − allocated + refunded. */
@Entity('invoice_lines')
@Index('uq_invoice_lines_fee', ['orgId', 'studentId', 'feeHeadId', 'period'], {
  unique: true,
  where: `"kind" = 'fee' AND "cancelled" = false`,
})
@Index('uq_invoice_lines_fine', ['orgId', 'invoiceId', 'lateFineRuleId'], {
  unique: true,
  where: `"kind" = 'fine'`,
})
@Index('idx_invoice_lines_invoice', ['orgId', 'invoiceId'])
export class InvoiceLine extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId: string;

  @ManyToOne(() => Invoice, (i) => i.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice?: Invoice;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @Column({ type: 'varchar', length: 8 })
  kind: InvoiceLineKind;

  @Column({ name: 'fee_head_id', type: 'uuid', nullable: true })
  feeHeadId: string | null;

  @ManyToOne(() => FeeHead, { nullable: true })
  @JoinColumn({ name: 'fee_head_id' })
  feeHead?: FeeHead | null;

  @Column({ name: 'late_fine_rule_id', type: 'uuid', nullable: true })
  lateFineRuleId: string | null;

  @ManyToOne(() => LateFineRule, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'late_fine_rule_id' })
  lateFineRule?: LateFineRule | null;

  @Column({ type: 'varchar', length: 7 })
  period: string;

  @Column({ type: 'varchar', length: 200 })
  description: string;

  @Column(money('amount'))
  amount: number;

  @Column(money('discount'))
  discount: number;

  /** Which discounts made up `discount` (the discount report). */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  discounts: { discountTypeId: string; amount: number }[];

  /** `amount − discount`. */
  @Column(money('net'))
  net: number;

  /** Approved waivers, corrections and refunds. */
  @Column(money('adjusted'))
  adjusted: number;

  /** Live allocations (reversals take theirs back). */
  @Column(money('allocated'))
  allocated: number;

  @Column(money('refunded'))
  refunded: number;

  /** Lines of a cancelled invoice. */
  @Column({ type: 'boolean', default: false })
  cancelled: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
