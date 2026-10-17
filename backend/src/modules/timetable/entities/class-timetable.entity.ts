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
import { AcademicYear } from '../../academic-years/entities/academic-year.entity';
import { Class } from '../../classes/entities/class.entity';
import { Employee } from '../../employees/entities/employee.entity';
import { Section } from '../../sections/entities/section.entity';
import { Subject } from '../../subjects/entities/subject.entity';
import { DayOfWeek } from '../enums/day-of-week.enum';
import { Period } from './period.entity';

/** One scheduled slot: a subject taught by a teacher in a class-section. */
@Entity('class_timetables')
@Index(
  'uq_timetable_slot',
  ['orgId', 'academicYearId', 'classId', 'sectionId', 'dayOfWeek', 'periodId'],
  { unique: true },
)
export class ClassTimetable extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  @Column({ name: 'day_of_week', type: 'varchar', length: 12 })
  dayOfWeek: DayOfWeek;

  @Column({ name: 'period_id', type: 'uuid' })
  periodId: string;

  @ManyToOne(() => Period, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'period_id' })
  period: Period;

  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  @ManyToOne(() => Subject, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subject_id' })
  subject: Subject;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
