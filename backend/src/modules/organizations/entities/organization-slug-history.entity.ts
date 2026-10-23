import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Organization } from './organization.entity';

/**
 * A school's previous slug (doc/domains-and-routing.md, section 2). Until
 * `expires_at` (12 months after the rename) it redirects to the school's
 * current slug and no other school can claim it. Platform table: read before
 * a tenant is known, through the root connection, so it is not
 * `OrgScopedEntity` and has no RLS.
 */
@Entity('organization_slug_history', { schema: 'public' })
export class OrganizationSlugHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  org?: Organization;

  @Index('uq_organization_slug_history_slug', { unique: true })
  @Column({ type: 'varchar', length: 63 })
  slug: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;
}
