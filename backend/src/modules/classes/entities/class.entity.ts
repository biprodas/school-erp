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
import { ClassSection } from './class-section.entity';

@Entity('classes')
@Index('uq_classes_org_name', ['orgId', 'name'], { unique: true })
export class Class extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  code: string | null;

  /** Numeric grade/order used to sort classes (e.g. 1 = Grade 1). */
  @Column({ type: 'int', nullable: true })
  level: number | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => ClassSection, (link) => link.schoolClass)
  classSections: ClassSection[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
