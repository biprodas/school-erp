import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';
import { SubjectGroupSubject } from './subject-group-subject.entity';

/**
 * A reusable, school-wide stream/grouping of subjects (e.g. Science,
 * Commerce, Arts). Availability to a class in a given year is expressed via
 * `class_subject_groups`; its member subjects via `subject_group_subjects`.
 */
@Entity('subject_groups')
@Index('uq_subject_groups_org_name', ['orgId', 'name'], { unique: true })
export class SubjectGroup extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  code: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => SubjectGroupSubject, (link) => link.subjectGroup)
  subjectLinks: SubjectGroupSubject[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
