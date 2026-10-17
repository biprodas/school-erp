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
import { SubjectGroup } from '../../subject-groups/entities/subject-group.entity';

/** A subject group made available to a class in a given academic year. */
@Entity('class_subject_groups')
@Index(
  'uq_class_subject_group',
  ['orgId', 'classId', 'subjectGroupId', 'academicYearId'],
  { unique: true },
)
export class ClassSubjectGroup extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'class_id', type: 'uuid' })
  classId: string;

  @ManyToOne(() => Class, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  schoolClass: Class;

  @Column({ name: 'subject_group_id', type: 'uuid' })
  subjectGroupId: string;

  @ManyToOne(() => SubjectGroup, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subject_group_id' })
  subjectGroup: SubjectGroup;

  @Column({ name: 'academic_year_id', type: 'uuid' })
  academicYearId: string;

  @ManyToOne(() => AcademicYear, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'academic_year_id' })
  academicYear: AcademicYear;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
