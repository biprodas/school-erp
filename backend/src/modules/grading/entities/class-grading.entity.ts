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
import { GradingSystem } from './grading-system.entity';

/** The grading system a class uses in a session (else the default). */
@Entity('class_grading')
@Index('uq_class_grading', ['orgId', 'academicYearId', 'classId'], {
  unique: true,
})
export class ClassGrading extends OrgScopedEntity {
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

  /** A system in use can't be deleted. */
  @Column({ name: 'grading_system_id', type: 'uuid' })
  gradingSystemId: string;

  @ManyToOne(() => GradingSystem)
  @JoinColumn({ name: 'grading_system_id' })
  gradingSystem?: GradingSystem;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
