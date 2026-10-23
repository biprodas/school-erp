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
import { Employee } from '~/modules/employees/entities/employee.entity';
import { Section } from '~/modules/sections/entities/section.entity';

/**
 * An employee as (a) class teacher of a section, effective-dated (PRD 6.4):
 * a change of teacher ends this row (`effective_to`) and opens a new one,
 * so past records still show who was in charge. Days are inclusive.
 */
@Entity('class_teachers')
// One current row per teacher and section.
@Index('uq_class_teachers_current', ['orgId', 'sectionId', 'employeeId'], {
  unique: true,
  where: '"effective_to" IS NULL',
})
// At most one current primary class teacher per section.
@Index('uq_class_teachers_org_primary', ['orgId', 'sectionId'], {
  unique: true,
  where: '"is_primary" AND "effective_to" IS NULL',
})
@Index('idx_class_teachers_employee', ['orgId', 'employeeId'])
export class ClassTeacher extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'section_id', type: 'uuid' })
  sectionId: string;

  @ManyToOne(() => Section, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'section_id' })
  section?: Section;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee?: Employee;

  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary: boolean;

  /** First day in charge. */
  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom: string;

  /** Last day in charge; null while current. */
  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
