import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';
import { SubjectType } from '../enums/subject-type.enum';

@Entity('subjects')
@Index('uq_subjects_org_name', ['orgId', 'name'], { unique: true })
@Index('uq_subjects_org_code', ['orgId', 'code'], { unique: true })
export class Subject extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  code: string | null;

  @Column({ type: 'varchar', length: 16, default: SubjectType.THEORY })
  type: string;

  @Column({ name: 'is_optional', type: 'boolean', default: false })
  isOptional: boolean;

  @Column({ type: 'int', nullable: true })
  credit: number | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
