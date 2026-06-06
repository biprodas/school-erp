import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { TenantStatus } from '../enums/tenant-status.enum';
import { TenantBootstrapStatus } from '../enums/tenant-bootstrap-status.enum';
import { Membership } from 'src/modules/platform/memberships/entities/membership.entity';

@Entity('tenants', { schema: 'public' })
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Acme Secondary School
  @Column()
  name: string;

  // 001_acme (alternative to subdomain)
  @Column({ unique: true })
  slug: string;

  // tenant_001_acme (generated)
  @Column({ name: 'schema_name', unique: true })
  schemaName: string;

  // acme.myapp:com or erp.acme.com
  @Column({ nullable: true, unique: true })
  domain: string;

  @Column({ type: 'enum', enum: TenantStatus, default: TenantStatus.ACTIVE })
  status: TenantStatus;

  // Owner-onboarding progress. Defaults to COMPLETED so pre-existing tenants are
  // never trapped in the wizard; `createTenant` assigns the real starting value.
  @Column({
    name: 'bootstrap_status',
    type: 'enum',
    enum: TenantBootstrapStatus,
    default: TenantBootstrapStatus.COMPLETED,
  })
  bootstrapStatus: TenantBootstrapStatus;

  @OneToMany(() => Membership, (membership) => membership.tenant)
  memberships: Membership[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
