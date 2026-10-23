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
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';
import { Class } from '~/modules/classes/entities/class.entity';
import { StudentEnrollment } from '~/modules/enrollments/entities/student-enrollment.entity';
import { Section } from '~/modules/sections/entities/section.entity';
import { Student } from '~/modules/students/entities/student.entity';
import { PromotionOutcome } from '../enums/promotion.enum';
import { PromotionBatch } from './promotion-batch.entity';

/** One student's outcome in a promotion batch. */
@Entity('promotion_batch_items')
@Index('uq_promotion_batch_items_student', ['orgId', 'batchId', 'studentId'], {
  unique: true,
})
export class PromotionBatchItem extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'batch_id', type: 'uuid' })
  batchId: string;

  @ManyToOne(() => PromotionBatch, (b) => b.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'batch_id' })
  batch?: PromotionBatch;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student?: Student;

  /** The enrollment being promoted (null only on legacy rows). */
  @Column({ name: 'enrollment_id', type: 'uuid', nullable: true })
  enrollmentId: string | null;

  @ManyToOne(() => StudentEnrollment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'enrollment_id' })
  enrollment?: StudentEnrollment | null;

  @Column({ type: 'varchar', length: 16 })
  outcome: PromotionOutcome;

  /** Null for `graduate`. */
  @Column({ name: 'to_class_id', type: 'uuid', nullable: true })
  toClassId: string | null;

  @ManyToOne(() => Class, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'to_class_id' })
  toClass?: Class | null;

  @Column({ name: 'to_section_id', type: 'uuid', nullable: true })
  toSectionId: string | null;

  @ManyToOne(() => Section, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'to_section_id' })
  toSection?: Section | null;

  @Column({ name: 'new_roll', type: 'varchar', length: 40, nullable: true })
  newRoll: string | null;

  /** Changed by hand after the draft was built. */
  @Column({ type: 'boolean', default: false })
  overridden: boolean;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  /** Set at commit; removed again by rollback. */
  @Column({ name: 'new_enrollment_id', type: 'uuid', nullable: true })
  newEnrollmentId: string | null;

  /** The student's status before a graduation, to restore on rollback. */
  @Column({
    name: 'previous_status',
    type: 'varchar',
    length: 16,
    nullable: true,
  })
  previousStatus: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
