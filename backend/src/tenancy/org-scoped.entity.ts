import { Column, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Organization } from '~/modules/organizations/entities/organization.entity';

/**
 * Base class for every tenanted (school-owned) entity in the shared schema.
 *
 * Adds the `org_id` discriminator with a cascading FK to `organizations`, so
 * deleting an organization removes all of its rows. Isolation is enforced
 * twice: `BaseTenantRepository` scopes every query/write to the request's
 * org, and a Postgres row-level-security policy on `org_id` backs it up
 * (see `rls.ts`).
 *
 * Per-org uniqueness must include `orgId`, e.g.
 * `@Index('uq_classes_org_name', ['orgId', 'name'], { unique: true })`.
 */
export abstract class OrgScopedEntity {
  @Index()
  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  org?: Organization;
}
