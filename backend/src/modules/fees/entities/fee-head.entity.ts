import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';
import { FeeFrequency } from '../enums/fee.enum';

/** A kind of fee (tuition, admission, exam, …), billed at its frequency. */
@Entity('fee_heads')
@Index('uq_fee_heads_org_name', ['orgId', 'name'], { unique: true })
export class FeeHead extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ name: 'name_bn', type: 'varchar', length: 80, nullable: true })
  nameBn: string | null;

  @Column({ type: 'varchar', length: 16 })
  frequency: FeeFrequency;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
