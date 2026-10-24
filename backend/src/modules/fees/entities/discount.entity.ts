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
import { Student } from '~/modules/students/entities/student.entity';
import { ApprovalStatus, DiscountCode, DiscountKind } from '../enums/fee.enum';

/** A kind of discount (sibling, merit, staff child, …). */
@Entity('discount_types')
@Index('uq_discount_types_org_name', ['orgId', 'name'], { unique: true })
export class DiscountType extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'varchar', length: 24, default: DiscountCode.CUSTOM })
  code: DiscountCode;

  @Column({ type: 'varchar', length: 16 })
  kind: DiscountKind;

  /** Basis points (percent) or minor units per fee line (fixed). */
  @Column({ type: 'bigint', transformer: MoneyColumn })
  value: number;

  /** Fee heads it applies to; empty = every head. */
  @Column({
    name: 'applies_to_head_ids',
    type: 'uuid',
    array: true,
    default: () => "'{}'",
  })
  appliesToHeadIds: string[];

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

/** A discount given to a student for some periods; applies once approved. */
@Entity('student_discounts')
@Index('idx_student_discounts_student', ['orgId', 'studentId', 'status'])
export class StudentDiscount extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student?: Student;

  @Column({ name: 'discount_type_id', type: 'uuid' })
  discountTypeId: string;

  @ManyToOne(() => DiscountType)
  @JoinColumn({ name: 'discount_type_id' })
  discountType?: DiscountType;

  /** Replaces the type's value for this student. */
  @Column({
    name: 'value_override',
    type: 'bigint',
    nullable: true,
    transformer: MoneyColumn,
  })
  valueOverride: number | null;

  /** First period (`YYYY-MM`) it applies to. */
  @Column({ name: 'from_period', type: 'varchar', length: 7 })
  fromPeriod: string;

  /** Last period; null = open-ended. */
  @Column({ name: 'to_period', type: 'varchar', length: 7, nullable: true })
  toPeriod: string | null;

  @Column({ type: 'varchar', length: 16, default: ApprovalStatus.PENDING })
  status: ApprovalStatus;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

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
