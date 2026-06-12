import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AcademicYear } from '../../academic-years/entities/academic-year.entity';
import { Class } from '../../classes/entities/class.entity';
import { Section } from '../../sections/entities/section.entity';
import { Student } from '../../students/entities/student.entity';

/** An audit record of a student's movement between years/classes/sections. */
@Entity('student_promotions')
export class StudentPromotion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ name: 'from_year_id', type: 'uuid' })
  fromYearId: string;

  @ManyToOne(() => AcademicYear, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'from_year_id' })
  fromYear: AcademicYear;

  @Column({ name: 'to_year_id', type: 'uuid' })
  toYearId: string;

  @ManyToOne(() => AcademicYear, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'to_year_id' })
  toYear: AcademicYear;

  @Column({ name: 'from_class_id', type: 'uuid' })
  fromClassId: string;

  @ManyToOne(() => Class, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'from_class_id' })
  fromClass: Class;

  @Column({ name: 'to_class_id', type: 'uuid' })
  toClassId: string;

  @ManyToOne(() => Class, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'to_class_id' })
  toClass: Class;

  @Column({ name: 'from_section_id', type: 'uuid', nullable: true })
  fromSectionId: string | null;

  @ManyToOne(() => Section, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'from_section_id' })
  fromSection: Section | null;

  @Column({ name: 'to_section_id', type: 'uuid', nullable: true })
  toSectionId: string | null;

  @ManyToOne(() => Section, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'to_section_id' })
  toSection: Section | null;

  @Column({ name: 'promotion_date', type: 'date', nullable: true })
  promotionDate: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
