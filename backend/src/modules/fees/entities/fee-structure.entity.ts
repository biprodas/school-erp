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
import { AcademicYear } from '~/modules/academic-years/entities/academic-year.entity';
import { Class } from '~/modules/classes/entities/class.entity';
import { Shift } from '~/modules/shifts/entities/shift.entity';
import { SubjectGroup } from '~/modules/subject-groups/entities/subject-group.entity';
import { FeeHead } from './fee-head.entity';

/**
 * What a class pays in a session (PRD 6.10), optionally only for one group
 * or shift, between effective dates. For each head the most specific
 * structure in effect wins (group and shift over either over neither).
 */
@Entity('fee_structures')
@Index('idx_fee_structures_class', ['orgId', 'academicYearId', 'classId'])
export class FeeStructure extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ name: 'academic_year_id', type: 'uuid' })
  academicYearId: string;

  @ManyToOne(() => AcademicYear, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'academic_year_id' })
  academicYear?: AcademicYear;

  @Column({ name: 'class_id', type: 'uuid' })
  classId: string;

  @ManyToOne(() => Class, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  schoolClass?: Class;

  @Column({ name: 'subject_group_id', type: 'uuid', nullable: true })
  subjectGroupId: string | null;

  @ManyToOne(() => SubjectGroup, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subject_group_id' })
  subjectGroup?: SubjectGroup | null;

  @Column({ name: 'shift_id', type: 'uuid', nullable: true })
  shiftId: string | null;

  @ManyToOne(() => Shift, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shift_id' })
  shift?: Shift | null;

  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom: string;

  /** Inclusive; null = to the end of the session. */
  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo: string | null;

  @OneToMany(() => FeeStructureItem, (i) => i.structure)
  items?: FeeStructureItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

/** One head's amount in a structure. */
@Entity('fee_structure_items')
@Index('uq_fee_structure_items', ['orgId', 'feeStructureId', 'feeHeadId'], {
  unique: true,
})
export class FeeStructureItem extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'fee_structure_id', type: 'uuid' })
  feeStructureId: string;

  @ManyToOne(() => FeeStructure, (s) => s.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fee_structure_id' })
  structure?: FeeStructure;

  /** A head in a structure can't be deleted (deactivate it). */
  @Column({ name: 'fee_head_id', type: 'uuid' })
  feeHeadId: string;

  @ManyToOne(() => FeeHead)
  @JoinColumn({ name: 'fee_head_id' })
  feeHead?: FeeHead;

  /** Minor units (poisha). */
  @Column({ type: 'bigint', transformer: MoneyColumn })
  amount: number;

  /** Day of the month it is due (1–28); null = the school's billing day + grace. */
  @Column({ name: 'due_day', type: 'int', nullable: true })
  dueDay: number | null;

  /** Calendar months it bills in; null = by the head's frequency. */
  @Column({ type: 'int', array: true, nullable: true })
  months: number[] | null;
}
