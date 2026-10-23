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
import { Subject } from '~/modules/subjects/entities/subject.entity';
import { SubjectGroup } from '~/modules/subject-groups/entities/subject-group.entity';
import { ClassSubjectType } from '../enums/class-subject-type.enum';
import { ClassSubjectComponent } from './class-subject-component.entity';

/** A subject offered to a class in a given academic year. */
@Entity('class_subjects')
@Index(
  'uq_class_subject',
  ['orgId', 'classId', 'subjectId', 'academicYearId'],
  {
    unique: true,
  },
)
export class ClassSubject extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'class_id', type: 'uuid' })
  classId: string;

  @ManyToOne(() => Class, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  schoolClass: Class;

  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  @ManyToOne(() => Subject, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subject_id' })
  subject: Subject;

  @Column({ name: 'academic_year_id', type: 'uuid' })
  academicYearId: string;

  @ManyToOne(() => AcademicYear, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'academic_year_id' })
  academicYear: AcademicYear;

  @Column({
    name: 'subject_type',
    type: 'varchar',
    length: 16,
    default: ClassSubjectType.COMPULSORY,
  })
  subjectType: ClassSubjectType;

  /** The group (Science, …) the subject belongs to in this class, if any. */
  @Column({ name: 'subject_group_id', type: 'uuid', nullable: true })
  subjectGroupId: string | null;

  @ManyToOne(() => SubjectGroup, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'subject_group_id' })
  subjectGroup?: SubjectGroup | null;

  @Column({ name: 'weekly_classes', type: 'int', nullable: true })
  weeklyClasses: number | null;

  @Column({ name: 'pass_marks', type: 'int', nullable: true })
  passMarks: number | null;

  @Column({ name: 'full_marks', type: 'int', nullable: true })
  fullMarks: number | null;

  @OneToMany(() => ClassSubjectComponent, (c) => c.classSubject)
  components?: ClassSubjectComponent[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
