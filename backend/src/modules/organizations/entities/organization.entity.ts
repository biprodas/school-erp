import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { OrganizationStatus } from '../enums/organization-status.enum';
import { Membership } from 'src/modules/memberships/entities/membership.entity';

/**
 * A school (tenant). All tenanted rows reference it via `org_id`, so deleting
 * an organization cascades through every school-owned table.
 */
@Entity('organizations', { schema: 'public' })
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Acme Secondary School
  @Column()
  name: string;

  // acme (used as the subdomain / x-tenant-id header)
  @Column({ unique: true })
  slug: string;

  // acme.myapp:com or erp.acme.com
  @Column({ nullable: true, unique: true })
  domain: string;

  @Column({
    type: 'enum',
    enum: OrganizationStatus,
    default: OrganizationStatus.ACTIVE,
  })
  status: OrganizationStatus;

  @OneToMany(() => Membership, (membership) => membership.organization)
  memberships: Membership[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
