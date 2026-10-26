import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { OrganizationStatus } from '../enums/organization-status.enum';
import { OrganizationType } from '../enums/organization-type.enum';
import { Membership } from '~/modules/memberships/entities/membership.entity';
import { Plan } from '~/modules/plans/entities/plan.entity';
import type { PlanLimits } from '~/modules/plans/plans.catalog';

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

  // acme (the subdomain and x-tenant-id header; rules in shared/slug)
  @Column({ unique: true })
  slug: string;

  @Column({
    type: 'enum',
    enum: OrganizationStatus,
    default: OrganizationStatus.ACTIVE,
  })
  status: OrganizationStatus;

  @Column({
    type: 'enum',
    enum: OrganizationType,
    default: OrganizationType.SCHOOL,
  })
  type: OrganizationType;

  /** Subscription plan; null means Free (see `EntitlementService`). */
  @Column({ name: 'plan_id', type: 'uuid', nullable: true })
  planId: string | null;

  @ManyToOne(() => Plan, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'plan_id' })
  plan?: Plan | null;

  /** Modules bought on top of the plan (PRD 3.3 add-ons). */
  @Column({
    name: 'add_on_modules',
    type: 'text',
    array: true,
    default: () => "'{}'",
  })
  addOnModules: string[];

  /**
   * Per-school limits set by a super-admin; a key here replaces the plan's
   * value (`null` = unlimited).
   */
  @Column({ name: 'limit_overrides', type: 'jsonb', nullable: true })
  limitOverrides: Partial<PlanLimits> | null;

  @Column({ name: 'trial_ends_at', type: 'timestamptz', nullable: true })
  trialEndsAt: Date | null;

  /** Set when the onboarding checklist is completed or skipped (M1). */
  @Column({
    name: 'onboarding_completed_at',
    type: 'timestamptz',
    nullable: true,
  })
  onboardingCompletedAt: Date | null;

  /**
   * The curriculum template the school set up from (`nctb`, …). One per
   * school; another is refused while the school has classes.
   */
  @Column({
    name: 'curriculum_template',
    type: 'varchar',
    length: 40,
    nullable: true,
  })
  curriculumTemplate: string | null;

  /** Listed in the public "Find your school" directory. */
  @Column({ name: 'listed_in_directory', type: 'boolean', default: false })
  listedInDirectory: boolean;

  /** Bangladesh Educational Institution Identification Number. */
  @Column({ type: 'varchar', length: 10, nullable: true })
  eiin: string | null;

  /** A `files` row of this school (purpose `org_logo`). */
  @Column({ name: 'logo_file_id', type: 'uuid', nullable: true })
  logoFileId: string | null;

  /** Group or trust the school belongs to (Phase 3; unused until then). */
  @Column({ name: 'parent_org_id', type: 'uuid', nullable: true })
  parentOrgId: string | null;

  @ManyToOne(() => Organization, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'parent_org_id' })
  parentOrg?: Organization | null;

  @OneToMany(() => Membership, (membership) => membership.organization)
  memberships: Membership[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
