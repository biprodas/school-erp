import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';
import { DomainStatus } from '../enums/domain-status.enum';
import { DomainTlsStatus } from '../enums/domain-tls-status.enum';

/**
 * A custom app host a school maps to the product, e.g. `erp.acme-scl.com`
 * (see doc/domains-and-routing.md, section 7).
 *
 * Org-scoped (RLS) so a school's own domain settings can be managed through
 * the tenant repositories. Resolving a host to its school happens before any
 * tenant is known, so `OrganizationService.findByDomain` reads it through the
 * root connection.
 */
@Entity('organization_domains')
// Unlike other tenanted keys, a hostname is unique across ALL schools: one
// host can only ever point at one school.
@Index('uq_organization_domains_hostname', ['hostname'], { unique: true })
// At most one primary domain per school.
@Index('uq_organization_domains_org_primary', ['orgId'], {
  unique: true,
  where: '"is_primary"',
})
export class OrganizationDomain extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Lower-case host without port or trailing dot. */
  @Column({ type: 'varchar', length: 253 })
  hostname: string;

  /** The subdomain redirects here when set (only one per school). */
  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary: boolean;

  @Column({ type: 'varchar', length: 16, default: DomainStatus.PENDING })
  status: DomainStatus;

  /** Value the school publishes in the `_school-verify.<hostname>` TXT record. */
  @Column({ name: 'verification_token', type: 'varchar', length: 64 })
  verificationToken: string;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  @Column({
    name: 'tls_status',
    type: 'varchar',
    length: 16,
    default: DomainTlsStatus.PENDING,
  })
  tlsStatus: DomainTlsStatus;

  /** Last DNS check, successful or not. */
  @Column({ name: 'last_checked_at', type: 'timestamptz', nullable: true })
  lastCheckedAt: Date | null;

  /**
   * When the records of a verified domain started failing; cleared when they
   * pass again. After a grace period the domain becomes `inactive`.
   */
  @Column({ name: 'dns_failing_since', type: 'timestamptz', nullable: true })
  dnsFailingSince: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
