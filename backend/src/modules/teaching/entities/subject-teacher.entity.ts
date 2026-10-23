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
import { ClassSubject } from '~/modules/class-curriculum/entities/class-subject.entity';
import { Employee } from '~/modules/employees/entities/employee.entity';
import { Section } from '~/modules/sections/entities/section.entity';

/**
 * An employee teaching a class subject in a section, effective-dated like
 * {@link ClassTeacher}. The class subject is in the section's class and
 * session.
 */
@Entity('subject_teachers')
// One current row per teacher, section and subject.
@Index(
  'uq_subject_teachers_current',
  ['orgId', 'sectionId', 'classSubjectId', 'employeeId'],
  { unique: true, where: '"effective_to" IS NULL' },
)
@Index('idx_subject_teachers_employee', ['orgId', 'employeeId'])
export class SubjectTeacher extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'section_id', type: 'uuid' })
  sectionId: string;

  @ManyToOne(() => Section, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'section_id' })
  section?: Section;

  @Column({ name: 'class_subject_id', type: 'uuid' })
  classSubjectId: string;

  @ManyToOne(() => ClassSubject, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_subject_id' })
  classSubject?: ClassSubject;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee?: Employee;

  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom: string;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
