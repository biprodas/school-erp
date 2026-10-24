import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MoneyColumn } from '~/shared/database/numeric-column';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';
import { Guardian } from '~/modules/guardians/entities/guardian.entity';
import { Student } from '~/modules/students/entities/student.entity';
import {
  PaymentChannel,
  PaymentStatus,
  ReceiptStatus,
} from '../enums/fee.enum';
import { Invoice, InvoiceLine } from './invoice.entity';

/**
 * Money received (PRD 6.10). Never edited or deleted: a cancelled receipt
 * reverses it (`payment_reversals`) and releases its allocations.
 */
@Entity('payments')
@Index('idx_payments_received', ['orgId', 'receivedAt'])
export class Payment extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Set for one student's payment. */
  @Column({ name: 'student_id', type: 'uuid', nullable: true })
  studentId: string | null;

  @ManyToOne(() => Student, { nullable: true })
  @JoinColumn({ name: 'student_id' })
  student?: Student | null;

  /** Set when a guardian pays for several children at once. */
  @Column({ name: 'payer_guardian_id', type: 'uuid', nullable: true })
  payerGuardianId: string | null;

  @ManyToOne(() => Guardian, { nullable: true })
  @JoinColumn({ name: 'payer_guardian_id' })
  payerGuardian?: Guardian | null;

  @Column({ type: 'varchar', length: 16 })
  channel: PaymentChannel;

  @Column({ type: 'bigint', transformer: MoneyColumn })
  amount: number;

  /** Cheque number, card slip, bank slip reference. */
  @Column({ type: 'varchar', length: 80, nullable: true })
  reference: string | null;

  @Column({ name: 'received_by', type: 'uuid', nullable: true })
  receivedBy: string | null;

  @Column({ name: 'received_at', type: 'timestamptz' })
  receivedAt: Date;

  /** The school-day it was received (collector reports). */
  @Column({ name: 'received_on', type: 'date' })
  receivedOn: string;

  @Column({ type: 'varchar', length: 16, default: PaymentStatus.COMPLETED })
  status: PaymentStatus;

  @OneToMany(() => PaymentAllocation, (a) => a.payment)
  allocations?: PaymentAllocation[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

/** The part of a payment that settles one invoice line. */
@Entity('payment_allocations')
@Index('idx_payment_allocations_payment', ['orgId', 'paymentId'])
@Index('idx_payment_allocations_line', ['orgId', 'invoiceLineId'])
export class PaymentAllocation extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'payment_id', type: 'uuid' })
  paymentId: string;

  @ManyToOne(() => Payment, (p) => p.allocations)
  @JoinColumn({ name: 'payment_id' })
  payment?: Payment;

  @Column({ name: 'invoice_line_id', type: 'uuid' })
  invoiceLineId: string;

  @ManyToOne(() => InvoiceLine)
  @JoinColumn({ name: 'invoice_line_id' })
  invoiceLine?: InvoiceLine;

  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId: string;

  @ManyToOne(() => Invoice)
  @JoinColumn({ name: 'invoice_id' })
  invoice?: Invoice;

  @Column({ type: 'bigint', transformer: MoneyColumn })
  amount: number;

  /** Set when the payment was reversed (the allocation no longer counts). */
  @Column({ name: 'reversed_at', type: 'timestamptz', nullable: true })
  reversedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

/** The numbered receipt of a payment (gap-free, never reused). */
@Entity('receipts')
@Index('uq_receipts_org_number', ['orgId', 'number'], { unique: true })
@Index('uq_receipts_payment', ['orgId', 'paymentId'], { unique: true })
export class Receipt extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 40 })
  number: string;

  @Column({ name: 'payment_id', type: 'uuid' })
  paymentId: string;

  @ManyToOne(() => Payment)
  @JoinColumn({ name: 'payment_id' })
  payment?: Payment;

  @Column({ name: 'issued_at', type: 'timestamptz' })
  issuedAt: Date;

  @Column({ name: 'issued_by', type: 'uuid', nullable: true })
  issuedBy: string | null;

  @Column({ type: 'varchar', length: 16, default: ReceiptStatus.VALID })
  status: ReceiptStatus;

  @Column({ name: 'cancel_reason', type: 'text', nullable: true })
  cancelReason: string | null;

  @Column({ name: 'cancelled_by', type: 'uuid', nullable: true })
  cancelledBy: string | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;
}

/** Why and by whom a payment was reversed (receipt cancellation). */
@Entity('payment_reversals')
@Index('uq_payment_reversals_payment', ['orgId', 'paymentId'], { unique: true })
export class PaymentReversal extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'payment_id', type: 'uuid' })
  paymentId: string;

  @ManyToOne(() => Payment)
  @JoinColumn({ name: 'payment_id' })
  payment?: Payment;

  @Column({ name: 'receipt_id', type: 'uuid' })
  receiptId: string;

  @Column({ type: 'bigint', transformer: MoneyColumn })
  amount: number;

  @Column({ type: 'text' })
  reason: string;

  @Column({ name: 'reversed_by', type: 'uuid', nullable: true })
  reversedBy: string | null;

  @CreateDateColumn({ name: 'reversed_at', type: 'timestamptz' })
  reversedAt: Date;
}
