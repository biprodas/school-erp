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
import { AcademicYear } from '~/modules/academic-years/entities/academic-year.entity';
import { Class } from '~/modules/classes/entities/class.entity';
import { Room } from '~/modules/rooms/entities/room.entity';
import { Shift } from '~/modules/shifts/entities/shift.entity';

/**
 * A section of a class in one session (Class 6, Section A, 2026), running
 * in one shift (PRD 6.4). Enrollments, teacher assignments and, later,
 * attendance and marks point at it, so a section id alone identifies the
 * class and the session. Session rollover copies sections with new ids.
 */
@Entity('sections')
@Index(
  'uq_sections_org_year_class_name',
  ['orgId', 'academicYearId', 'classId', 'name'],
  { unique: true },
)
export class Section extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  @Column({ name: 'shift_id', type: 'uuid', nullable: true })
  shiftId: string | null;

  @ManyToOne(() => Shift, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'shift_id' })
  shift?: Shift | null;

  @Column({ type: 'varchar', length: 60 })
  name: string;

  /** Seats; informational until batch-style capacity checks arrive. */
  @Column({ type: 'int', nullable: true })
  capacity: number | null;

  /** Home room. */
  @Column({ name: 'room_id', type: 'uuid', nullable: true })
  roomId: string | null;

  @ManyToOne(() => Room, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'room_id' })
  room?: Room | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
