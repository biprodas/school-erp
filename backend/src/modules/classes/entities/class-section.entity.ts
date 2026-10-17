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
import { Section } from '../../sections/entities/section.entity';
import { Class } from './class.entity';

/**
 * Join entity linking a {@link Class} to a global {@link Section}, carrying
 * the per-class-section capacity. A section (e.g. "A") can be attached to
 * many classes; each (class, section) pair is unique.
 */
@Entity('class_sections')
@Index('uq_class_section', ['orgId', 'classId', 'sectionId'], { unique: true })
export class ClassSection extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'class_id', type: 'uuid' })
  classId: string;

  @ManyToOne(() => Class, (cls) => cls.classSections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  schoolClass: Class;

  @Column({ name: 'section_id', type: 'uuid' })
  sectionId: string;

  @ManyToOne(() => Section, (section) => section.classLinks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'section_id' })
  section: Section;

  @Column({ type: 'int', nullable: true })
  capacity: number | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
