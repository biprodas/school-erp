import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SubjectGroupSubject } from './subject-group-subject.entity';

/**
 * A reusable, school-wide stream/grouping of subjects (e.g. Science,
 * Commerce, Arts). Availability to a class in a given year is expressed via
 * `class_subject_groups`; its member subjects via `subject_group_subjects`.
 */
@Entity('subject_groups')
export class SubjectGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120, unique: true })
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
