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
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';
import { AcademicYear } from '~/modules/academic-years/entities/academic-year.entity';
import { Class } from '~/modules/classes/entities/class.entity';
import { Section } from '~/modules/sections/entities/section.entity';
import { Student } from '~/modules/students/entities/student.entity';
import { StudentEnrollmentStatus } from '../enums/student-enrollment-status.enum';
import { StudentSubject } from './student-subject.entity';

/** A student's placement (class + section) for one academic year. */
@Entity('student_enrollments')
@Index('uq_enrollment_student_year', ['orgId', 'studentId', 'academicYearId'], {
  unique: true,
})
@Index(
  'uq_enrollment_roll',
  ['orgId', 'academicYearId', 'classId', 'sectionId', 'rollNo'],
  { unique: true },
)
export class StudentEnrollment extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ name: 'academic_year_id', type: 'uuid' })
  academicYearId: string;

  @ManyToOne(() => AcademicYear, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'academic_year_id' })
  academicYear: AcademicYear;

  @Column({ name: 'class_id', type: 'uuid' })
  classId: string;

  @ManyToOne(() => Class, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  schoolClass: Class;

  @Column({ name: 'section_id', type: 'uuid' })
  sectionId: string;

  @ManyToOne(() => Section, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'section_id' })
  section: Section;

  @Column({ name: 'roll_no', type: 'varchar', length: 40, nullable: true })
  rollNo: string | null;

  @Column({
    type: 'varchar',
    length: 16,
    default: StudentEnrollmentStatus.ACTIVE,
  })
  status: string;

  @OneToMany(() => StudentSubject, (link) => link.enrollment)
  subjects: StudentSubject[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
