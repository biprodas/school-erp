import {
  BadRequestException,
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, In } from 'typeorm';
import { Organization } from '../entities/organization.entity';
import { OrganizationDomain } from '../entities/organization-domain.entity';
import { OrganizationSlugHistory } from '../entities/organization-slug-history.entity';
import { RESOLVABLE_DOMAIN_STATUSES } from '../enums/domain-status.enum';
import { OrganizationStatus } from '../enums/organization-status.enum';
import { OrganizationType } from '../enums/organization-type.enum';
import {
  SLUG_HISTORY_TTL_MS,
  SLUG_RENAME_INTERVAL_MS,
  SlugService,
} from './slug.service';
import { Plan } from '~/modules/plans/entities/plan.entity';
import {
  PLAN_LIMIT_KEYS,
  PlanCode,
  type PlanLimits,
  TRIAL_DAYS,
} from '~/modules/plans/plans.catalog';
import { EntitlementService } from '~/modules/plans/services/entitlement.service';
import { OrgSettings } from '~/modules/settings/entities/org-settings.entity';
import { Paginated } from '~/common/dto/paginated.dto';
import { DEFAULT_PAGE_SIZE } from '~/common/dto/pagination-query.dto';
import { Membership } from '~/modules/memberships/entities/membership.entity';
import { MembershipRole } from '~/modules/memberships/enums/membership-role.enum';
import { User } from '~/modules/users/entities/user.entity';
import { UserService } from '~/modules/users/services/user.service';
import {
  tenantDomainCache,
  tenantSlugCache,
} from '~/tenancy/tenant-slug.cache';
import { UserRole } from '~/modules/rbac/entities/user-role.entity';
import { RbacSeederService } from '~/modules/rbac/services/rbac-seeder.service';
import { OrgSettingsSeeder } from '~/modules/settings/services/org-settings.seeder';
import { SessionService } from '~/modules/auth/services/session.service';
import { OwnerProvisioningService } from '~/modules/auth/services/owner-provisioning.service';
import { CreateOrganizationDto } from '../dto/create-organization.dto';
import {
  DemoteOldOwnerTo,
  TransferOwnershipDto,
} from '../dto/transfer-ownership.dto';
import { UpdateOrganizationDto } from '../dto/update-organization.dto';
import {
  ChangePlanDto,
  ExtendTrialDto,
  FilterOrganizationDto,
  SetLimitsDto,
} from '../dto/platform-organization.dto';
import { RequestContextDto } from '~/common/dto/request-context.dto';
import {
  PLATFORM_PERMISSIONS,
  platformCan,
  type PlatformPermission,
} from '~/common/auth/platform-permissions';
import { PlatformAuditService } from '~/modules/audit/services/platform-audit.service';
import { AUDIT_ACTIONS, type AuditAction } from '~/modules/audit/audit-actions';

/** What the platform audit log keeps of an organization. */
function organizationSnapshot(org: Organization) {
  return { name: org.name, slug: org.slug, status: org.status, type: org.type };
}

/** One-time owner activation handed back when an owner is (re)provisioned. */
export interface OwnerActivation {
  token: string;
  orgSlug: string;
}

/** Whether the caller's platform role holds `permission`. */
const can = (ctx: RequestContextDto, permission: PlatformPermission) =>
  platformCan(ctx.user?.platformRole, permission);

export interface CreateOrganizationResult {
  organization: Organization;
  ownerActivation?: OwnerActivation;
}

/** A school created by self-serve signup (`SignupService`). */
export interface SignupOrganizationInput {
  name: string;
  slug: string;
  type: OrganizationType;
  ownerUserId: string;
}

/** A row of the school directory (`GET /organizations`, super-admin). */
export interface DirectoryEntry {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  type: OrganizationType;
  plan: { code: string; name: string } | null;
  addOnModules: string[];
  limitOverrides: Partial<PlanLimits> | null;
  trialEndsAt: Date | null;
  onboardingCompletedAt: Date | null;
  district: string | null;
  activeStudentCount: number;
  createdAt: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);

  constructor(
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    @InjectRepository(Membership)
    private membershipRepository: Repository<Membership>,
    @InjectRepository(OrganizationDomain)
    private domainRepository: Repository<OrganizationDomain>,
    @InjectRepository(Plan)
    private planRepository: Repository<Plan>,
    @InjectDataSource()
    private dataSource: DataSource,
    private slugService: SlugService,
    private entitlements: EntitlementService,
    private rbacSeederService: RbacSeederService,
    private orgSettingsSeeder: OrgSettingsSeeder,
    private userService: UserService,
    private ownerProvisioning: OwnerProvisioningService,
    private platformAudit: PlatformAuditService,
    private sessions: SessionService,
  ) {}

  /**
   * Creates an organization. Ownership rules:
   * - Non-admin caller: caller automatically becomes OWNER. Any
   *   `dto.ownerUserId` is ignored.
   * - Admin caller with `dto.ownerUserId`: that user becomes OWNER.
   * - Admin caller without `dto.ownerUserId`: the organization is created
   *   with no membership; assign an owner later via `transferOwnership`.
   *
   * Everything (org row, system roles, settings row, owner membership +
   * activation token) is written in one transaction, so a failure leaves nothing behind. The
   * activation email is sent after commit.
   */
  async createOrganization(
    ctx: RequestContextDto,
    dto: CreateOrganizationDto,
  ): Promise<CreateOrganizationResult> {
    const { user } = ctx;

    let owner: User | undefined;
    if (can(ctx, PLATFORM_PERMISSIONS.ORGANIZATIONS_MANAGE)) {
      if (dto.ownerUserId) {
        // Validate up-front so we never fail half-way through.
        owner = await this.userService.findById(ctx, dto.ownerUserId);
      }
    } else {
      owner = await this.userService.findById(ctx, user?.id ?? '');
    }

    const {
      ownerUserId: _ownerUserId,
      planCode = PlanCode.FREE,
      trialDays,
      ...fields
    } = dto;
    const plan = await this.findPlanOrFail(planCode);

    const { organization, token } = await this.dataSource.transaction(
      async (manager) => {
        const organization = await this.insertOrganization(manager, {
          ...fields,
          planId: plan.id,
          ...(trialDays
            ? {
                status: OrganizationStatus.TRIAL,
                trialEndsAt: new Date(Date.now() + trialDays * DAY_MS),
              }
            : {}),
        });

        let token: string | undefined;
        if (owner) {
          ({ token } = await this.ownerProvisioning.provisionOwner(manager, {
            orgId: organization.id,
            userId: owner.id,
          }));
        }
        await this.platformAudit.record(
          {
            action: AUDIT_ACTIONS.ORGANIZATION_CREATED,
            orgId: organization.id,
            entityType: 'organization',
            entityId: organization.id,
            after: {
              ...organizationSnapshot(organization),
              planCode: plan.code,
              ownerUserId: owner?.id ?? null,
            },
          },
          manager,
        );
        return { organization, token };
      },
    );

    let ownerActivation: OwnerActivation | undefined;
    if (owner && token) {
      await this.ownerProvisioning.sendActivationEmail(
        owner,
        organization.slug,
        token,
      );
      ownerActivation = { token, orgSlug: organization.slug };
    }

    return { organization, ownerActivation };
  }

  /**
   * Creates a school for a verified self-serve signup inside the caller's
   * transaction: a 30-day trial of the trial plan (on Free afterwards until
   * a plan is assigned), system roles, settings row and the owner's ACTIVE
   * membership. The caller has created or linked the owner's account.
   */
  async createForSignup(
    manager: EntityManager,
    input: SignupOrganizationInput,
  ): Promise<Organization> {
    const free = await manager
      .getRepository(Plan)
      .findOne({ where: { code: PlanCode.FREE } });
    const organization = await this.insertOrganization(manager, {
      name: input.name,
      slug: input.slug,
      type: input.type,
      status: OrganizationStatus.TRIAL,
      trialEndsAt: new Date(Date.now() + TRIAL_DAYS * DAY_MS),
      planId: free?.id ?? null,
    });
    await this.ownerProvisioning.provisionActiveOwner(manager, {
      orgId: organization.id,
      userId: input.ownerUserId,
    });
    await this.platformAudit.record(
      {
        action: AUDIT_ACTIONS.ORGANIZATION_CREATED,
        orgId: organization.id,
        entityType: 'organization',
        entityId: organization.id,
        actorUserId: input.ownerUserId,
        after: {
          ...organizationSnapshot(organization),
          ownerUserId: input.ownerUserId,
          via: 'signup',
        },
      },
      manager,
    );
    return organization;
  }

  /**
   * Inserts the organization with its system roles and settings row. The
   * slug must be free (not used, reserved or in another school's history).
   */
  private async insertOrganization(
    manager: EntityManager,
    fields: Partial<Organization>,
  ): Promise<Organization> {
    const slug = fields.slug!;
    await this.slugService.assertAvailable(slug, manager);
    await this.slugService.releaseForClaim(manager, slug);

    const organization = await manager.save(
      manager.create(Organization, fields),
    );
    // Seed the standard school roles for the new organization.
    await this.rbacSeederService.seedSystemRoles(manager, organization.id);
    // Its settings row, so settings writes only ever update (and lock) it.
    await this.orgSettingsSeeder.createRow(manager, organization.id);
    return organization;
  }

  /**
   * Atomically reassigns the OWNER membership of an organization to another
   * user, provisioning the new owner (school admin + activation token) in the
   * same transaction so the org never has zero or two OWNERs. Admin-only.
   */
  async transferOwnership(
    ctx: RequestContextDto,
    orgId: string,
    dto: TransferOwnershipDto,
  ): Promise<{ membership: Membership; ownerActivation?: OwnerActivation }> {
    if (!can(ctx, PLATFORM_PERMISSIONS.ORGANIZATIONS_MANAGE)) {
      throw new ForbiddenException(
        'Only platform admins can transfer organization ownership',
      );
    }

    const organization = await this.organizationRepository.findOne({
      where: { id: orgId },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    // Validate the target user up-front (outside the transaction is fine).
    const newOwnerUser = await this.userService.findById(
      ctx,
      dto.newOwnerUserId,
    );

    const { membership, token, signedOutUserId } =
      await this.dataSource.transaction(async (manager) => {
        const memberships = manager.getRepository(Membership);

        const existingOwners = await memberships.find({
          where: { orgId, role: MembershipRole.OWNER },
          order: { createdAt: 'ASC' },
        });
        if (existingOwners.length > 1) {
          this.logger.warn(
            `Organization ${orgId} has ${existingOwners.length} OWNER memberships; treating oldest as current`,
          );
        }
        const currentOwner = existingOwners[0];
        // Set when the old owner loses school-admin rights: `isAdmin` is in
        // their access token, so their sessions in this school end.
        let signedOutUserId: string | null = null;

        if (currentOwner && currentOwner.userId === dto.newOwnerUserId) {
          throw new BadRequestException('User is already the owner');
        }

        // Promote/insert the new owner (school admin, activation token).
        const { token } = await this.ownerProvisioning.provisionOwner(manager, {
          orgId,
          userId: dto.newOwnerUserId,
        });

        // Demote / remove the previous owner.
        if (currentOwner) {
          const fate = dto.demoteOldOwnerTo ?? DemoteOldOwnerTo.ADMIN;
          if (fate !== DemoteOldOwnerTo.ADMIN) {
            signedOutUserId = currentOwner.userId;
          }
          if (fate === DemoteOldOwnerTo.REMOVE) {
            await memberships.delete(currentOwner.id);
            await manager
              .getRepository(UserRole)
              .delete({ orgId, userId: currentOwner.userId });
          } else {
            currentOwner.role =
              fate === DemoteOldOwnerTo.MEMBER
                ? MembershipRole.MEMBER
                : MembershipRole.ADMIN;
            if (fate === DemoteOldOwnerTo.MEMBER) {
              currentOwner.isAdmin = false;
            }
            await memberships.save(currentOwner);
          }
        }

        // Demote any extra OWNER rows above the first (defensive).
        for (const extra of existingOwners.slice(1)) {
          if (extra.userId === dto.newOwnerUserId) continue;
          extra.role = MembershipRole.ADMIN;
          await memberships.save(extra);
        }

        const membership = await memberships.findOneOrFail({
          where: { orgId, userId: dto.newOwnerUserId },
        });
        await this.platformAudit.record(
          {
            action: AUDIT_ACTIONS.ORGANIZATION_OWNER_TRANSFERRED,
            orgId,
            entityType: 'organization',
            entityId: orgId,
            before: { ownerUserId: currentOwner?.userId ?? null },
            after: {
              ownerUserId: dto.newOwnerUserId,
              previousOwner: dto.demoteOldOwnerTo ?? DemoteOldOwnerTo.ADMIN,
            },
          },
          manager,
        );
        return { membership, token, signedOutUserId };
      });

    if (signedOutUserId) {
      await this.sessions.revokeAllForUserInOrg(signedOutUserId, orgId);
    }
    await this.ownerProvisioning.sendActivationEmail(
      newOwnerUser,
      organization.slug,
      token,
    );

    return {
      membership,
      ownerActivation: { token, orgSlug: organization.slug },
    };
  }

  /**
   * (Re)issues an owner activation link for an organization's current OWNER.
   * Mints a fresh token — the original raw token is unrecoverable (only its
   * hash is stored) — so this always issues a new one. Useful when the
   * original link expired or was lost. Allowed for the organization's own
   * OWNER and platform staff with `organizations:support`; the token comes
   * back only to the owner and staff who can manage schools.
   */
  async reissueOwnerActivation(
    ctx: RequestContextDto,
    orgId: string,
  ): Promise<{ orgSlug: string; token?: string }> {
    const organization = await this.organizationRepository.findOne({
      where: { id: orgId },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    // Support may resend the email; only managers and the owner see the
    // token, which would let its holder set the owner's password.
    const showToken = can(ctx, PLATFORM_PERMISSIONS.ORGANIZATIONS_MANAGE);
    if (!showToken && !can(ctx, PLATFORM_PERMISSIONS.ORGANIZATIONS_SUPPORT)) {
      await this.assertOwner(ctx, orgId, 'issue activation links');
    }

    const ownerMembership = await this.membershipRepository.findOne({
      where: { orgId, role: MembershipRole.OWNER },
      order: { createdAt: 'ASC' },
    });
    if (!ownerMembership) {
      throw new NotFoundException('Organization has no owner to activate');
    }

    const owner = await this.userService.findById(ctx, ownerMembership.userId);
    const { token } = await this.dataSource.transaction((manager) =>
      this.ownerProvisioning.provisionOwner(manager, {
        orgId,
        userId: owner.id,
      }),
    );
    await this.ownerProvisioning.sendActivationEmail(
      owner,
      organization.slug,
      token,
    );
    const isOwner = ownerMembership.userId === ctx.user?.id;
    return showToken || isOwner
      ? { token, orgSlug: organization.slug }
      : { orgSlug: organization.slug };
  }

  /**
   * Platform staff with `organizations:read` get the school directory (filtered, paginated); anyone
   * else the schools they belong to.
   */
  async getAllOrganizations(
    ctx: RequestContextDto,
    filter: FilterOrganizationDto = {},
  ): Promise<Organization[] | Paginated<DirectoryEntry>> {
    if (!can(ctx, PLATFORM_PERMISSIONS.ORGANIZATIONS_READ)) {
      return this.getOrganizationsByUser(ctx, ctx.user?.id ?? '');
    }
    return this.findDirectory(filter);
  }

  /** School directory with plan, district and active student count. */
  async findDirectory(
    filter: FilterOrganizationDto,
  ): Promise<Paginated<DirectoryEntry>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? DEFAULT_PAGE_SIZE;
    const qb = this.organizationRepository
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.plan', 'plan')
      .leftJoin(OrgSettings, 'settings', 'settings.orgId = o.id')
      .addSelect(`settings.profile -> 'address' ->> 'district'`, 'district')
      // Root connection: no RLS, so the subquery filters on org_id itself.
      .addSelect(
        `(SELECT count(*) FROM "students" s
          WHERE s."org_id" = o."id" AND s."status" = 'active'
            AND s."deleted_at" IS NULL)`,
        'active_students',
      );
    if (filter.q) {
      qb.andWhere('(o.name ILIKE :q OR o.slug ILIKE :q)', {
        q: `%${escapeLike(filter.q)}%`,
      });
    }
    if (filter.plan) {
      // Schools without a plan are on Free.
      qb.andWhere(
        filter.plan === PlanCode.FREE
          ? '(plan.code = :plan OR o.planId IS NULL)'
          : 'plan.code = :plan',
        { plan: filter.plan },
      );
    }
    if (filter.status) {
      qb.andWhere('o.status = :status', { status: filter.status });
    }
    if (filter.type) qb.andWhere('o.type = :type', { type: filter.type });
    if (filter.district) {
      qb.andWhere(
        `settings.profile -> 'address' ->> 'district' ILIKE :district`,
        { district: escapeLike(filter.district) },
      );
    }
    if (filter.createdFrom) {
      qb.andWhere('o.createdAt >= :from', { from: filter.createdFrom });
    }
    if (filter.createdTo) {
      qb.andWhere('o.createdAt <= :to', { to: filter.createdTo });
    }

    const total = await qb.getCount();
    const { entities, raw } = await qb
      .orderBy('o.createdAt', 'DESC')
      .addOrderBy('o.id', 'ASC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawAndEntities<{
        district: string | null;
        active_students: string;
      }>();

    const items = entities.map((org, i): DirectoryEntry => {
      const row = raw[i];
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        status: org.status,
        type: org.type,
        plan: org.plan ? { code: org.plan.code, name: org.plan.name } : null,
        addOnModules: org.addOnModules,
        limitOverrides: org.limitOverrides,
        trialEndsAt: org.trialEndsAt,
        onboardingCompletedAt: org.onboardingCompletedAt,
        district: row?.district ?? null,
        activeStudentCount: Number(row?.active_students ?? 0),
        createdAt: org.createdAt,
      };
    });
    return new Paginated(items, total, { page, limit });
  }

  /** `PATCH /organizations/:id/plan` (super-admin). */
  async changePlan(id: string, dto: ChangePlanDto): Promise<Organization> {
    const plan = await this.findPlanOrFail(dto.planCode);
    return this.changeAudited(
      id,
      AUDIT_ACTIONS.ORGANIZATION_PLAN_CHANGED,
      (org) => {
        org.planId = plan.id;
        org.plan = plan;
        if (dto.addOnModules) org.addOnModules = dto.addOnModules;
      },
      (org) => ({
        planCode: org.plan?.code ?? PlanCode.FREE,
        addOnModules: org.addOnModules,
      }),
    );
  }

  /**
   * `POST /organizations/:id/trial/extend` (super-admin): adds `days` to the
   * trial end, counted from now if it has already passed.
   */
  async extendTrial(id: string, dto: ExtendTrialDto): Promise<Organization> {
    return this.changeAudited(
      id,
      AUDIT_ACTIONS.ORGANIZATION_TRIAL_EXTENDED,
      (org) => {
        if (org.status !== OrganizationStatus.TRIAL) {
          throw new ConflictException({
            message: 'This school is not on a trial',
            code: 'NOT_ON_TRIAL',
          });
        }
        const from = Math.max(Date.now(), org.trialEndsAt?.getTime() ?? 0);
        org.trialEndsAt = new Date(from + dto.days * DAY_MS);
      },
      (org) => ({ trialEndsAt: org.trialEndsAt }),
    );
  }

  /** `PUT /organizations/:id/limits` (super-admin): replaces the overrides. */
  async setLimits(id: string, dto: SetLimitsDto): Promise<Organization> {
    const overrides: Partial<PlanLimits> = {};
    for (const key of PLAN_LIMIT_KEYS) {
      if (dto[key] !== undefined) overrides[key] = dto[key];
    }
    return this.changeAudited(
      id,
      AUDIT_ACTIONS.ORGANIZATION_LIMITS_CHANGED,
      (org) => {
        org.limitOverrides = Object.keys(overrides).length ? overrides : null;
      },
      (org) => ({ limitOverrides: org.limitOverrides }),
    );
  }

  /**
   * Applies a platform change to one school with a platform audit row in
   * the same transaction, then drops its cached entitlements.
   */
  private async changeAudited(
    id: string,
    action: AuditAction,
    change: (org: Organization) => void,
    snapshot: (org: Organization) => Record<string, unknown>,
  ): Promise<Organization> {
    const saved = await this.dataSource.transaction(async (manager) => {
      // Lock first (FOR UPDATE can't apply to the outer-joined plan).
      await manager.findOne(Organization, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      const org = await manager.findOne(Organization, {
        where: { id },
        relations: { plan: true },
      });
      if (!org) throw new NotFoundException('Organization not found');
      const before = snapshot(org);
      change(org);
      const result = await manager.save(org);
      await this.platformAudit.record(
        {
          action,
          orgId: id,
          entityType: 'organization',
          entityId: id,
          before,
          after: snapshot(result),
        },
        manager,
      );
      return result;
    });
    this.entitlements.invalidate(id);
    return saved;
  }

  /**
   * `PATCH /settings/slug` (school admin): at most once per 30 days. The
   * old slug goes to the history, where it redirects for 12 months and no
   * other school can take it; the school may later reclaim it.
   */
  async renameSlug(
    orgId: string,
    slug: string,
  ): Promise<{ slug: string; previousSlug: string }> {
    const previousSlug = await this.dataSource.transaction(async (manager) => {
      const org = await manager.findOne(Organization, {
        where: { id: orgId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!org) throw new NotFoundException('Organization not found');
      if (org.slug === slug) {
        throw new BadRequestException({
          message: 'This is already the school address',
          code: 'SLUG_UNCHANGED',
        });
      }
      const history = manager.getRepository(OrganizationSlugHistory);
      const last = await history.findOne({
        where: { orgId },
        order: { createdAt: 'DESC' },
      });
      if (
        last &&
        last.createdAt.getTime() > Date.now() - SLUG_RENAME_INTERVAL_MS
      ) {
        throw new ConflictException({
          message: 'The school address can be changed once every 30 days',
          code: 'SLUG_CHANGE_TOO_SOON',
          retryAfter: new Date(
            last.createdAt.getTime() + SLUG_RENAME_INTERVAL_MS,
          ),
        });
      }
      await this.slugService.assertAvailable(slug, manager, orgId);
      await this.slugService.releaseForClaim(manager, slug, orgId);

      const old = org.slug;
      await history.save(
        history.create({
          orgId,
          slug: old,
          expiresAt: new Date(Date.now() + SLUG_HISTORY_TTL_MS),
        }),
      );
      org.slug = slug;
      await manager.save(org);
      await this.platformAudit.record(
        {
          action: AUDIT_ACTIONS.ORGANIZATION_SLUG_CHANGED,
          orgId,
          entityType: 'organization',
          entityId: orgId,
          before: { slug: old },
          after: { slug },
        },
        manager,
      );
      return old;
    });
    tenantSlugCache.invalidate(previousSlug);
    tenantSlugCache.invalidate(slug);
    await this.invalidateDomainCache(orgId);
    return { slug, previousSlug };
  }

  /** The school an old slug now points to (`TenantMiddleware`, resolve). */
  findSlugRedirect(slug: string): Promise<Organization | null> {
    return this.slugService.findRedirect(slug);
  }

  async getOnboardingCompletedAt(orgId: string): Promise<Date | null> {
    const org = await this.organizationRepository.findOne({
      where: { id: orgId },
      select: { id: true, onboardingCompletedAt: true },
    });
    return org?.onboardingCompletedAt ?? null;
  }

  /**
   * Sets or clears `onboarding_completed_at` (`OnboardingService`, which
   * audits it in the school's log).
   */
  async setOnboardingCompleted(
    orgId: string,
    completedAt: Date | null,
  ): Promise<void> {
    await this.organizationRepository.update(
      { id: orgId },
      { onboardingCompletedAt: completedAt },
    );
  }

  async getCurriculumTemplate(orgId: string): Promise<string | null> {
    const org = await this.organizationRepository.findOne({
      where: { id: orgId },
      select: { id: true, curriculumTemplate: true },
    });
    return org?.curriculumTemplate ?? null;
  }

  /** Records the curriculum template a school applied (onboarding). */
  async setCurriculumTemplate(orgId: string, code: string): Promise<void> {
    await this.organizationRepository.update(
      { id: orgId },
      { curriculumTemplate: code },
    );
  }

  private async findPlanOrFail(code: string): Promise<Plan> {
    const plan = await this.planRepository.findOne({ where: { code } });
    if (!plan) {
      throw new NotFoundException({
        message: 'Plan not found',
        code: 'PLAN_NOT_FOUND',
      });
    }
    return plan;
  }

  /** Returns only organizations where the user has any membership. */
  async getOrganizationsByUser(
    _ctx: RequestContextDto,
    userId: string,
  ): Promise<Organization[]> {
    const memberships = await this.membershipRepository.find({
      where: { userId },
    });
    const orgIds = memberships.map((m) => m.orgId);
    if (!orgIds.length) return [];
    return this.organizationRepository.find({ where: { id: In(orgIds) } });
  }

  async findById(
    _ctx: RequestContextDto,
    id: string,
  ): Promise<Organization | null> {
    return this.organizationRepository.findOne({ where: { id } });
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    return this.organizationRepository.findOne({ where: { slug } });
  }

  /**
   * Look up an organization by one of its custom domains (full host). Only
   * verified or active domains resolve; a pending one (DNS ownership not yet
   * proven) never routes traffic to the school.
   */
  async findByDomain(host: string): Promise<Organization | null> {
    const hostname = normalizeHostname(host);
    if (!hostname) return null;
    const domain = await this.domainRepository.findOne({
      where: { hostname, status: In([...RESOLVABLE_DOMAIN_STATUSES]) },
      relations: { org: true },
    });
    return domain?.org ?? null;
  }

  /**
   * Returns an organization only if the requester may read every school
   * (`organizations:read`) or has a membership in it.
   */
  async findByIdForUser(
    ctx: RequestContextDto,
    id: string,
  ): Promise<Organization> {
    const organization = await this.findById(ctx, id);
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    if (can(ctx, PLATFORM_PERMISSIONS.ORGANIZATIONS_READ)) return organization;

    const membership = await this.membershipRepository.findOne({
      where: { orgId: id, userId: ctx.user?.id ?? '' },
    });
    if (!membership) {
      throw new ForbiddenException('Access denied');
    }
    return organization;
  }

  async updateOrganization(
    ctx: RequestContextDto,
    id: string,
    dto: UpdateOrganizationDto,
  ): Promise<Organization> {
    const organization = await this.findById(ctx, id);
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    if (!can(ctx, PLATFORM_PERMISSIONS.ORGANIZATIONS_MANAGE)) {
      // Status (active/suspended) is a platform decision; owners must not
      // be able to lift a suspension themselves.
      if (dto.status !== undefined && dto.status !== organization.status) {
        throw new ForbiddenException(
          'Only a platform admin can change the organization status',
        );
      }
      await this.assertOwner(ctx, id, 'update this organization');
    }

    const before = organizationSnapshot(organization);
    Object.assign(organization, dto);
    const saved = await this.dataSource.transaction(async (manager) => {
      const result = await manager.save(organization);
      await this.platformAudit.record(
        {
          action: AUDIT_ACTIONS.ORGANIZATION_UPDATED,
          orgId: id,
          entityType: 'organization',
          entityId: id,
          before,
          after: organizationSnapshot(result),
        },
        manager,
      );
      return result;
    });
    tenantSlugCache.invalidate(organization.slug);
    await this.invalidateDomainCache(organization.id);
    this.entitlements.invalidate(organization.id);
    return saved;
  }

  /**
   * Deletes an organization. Every org-scoped row (and its memberships and
   * tokens) references `organizations` with ON DELETE CASCADE, so one delete
   * removes all of the school's data. Global user accounts are kept.
   */
  async deleteOrganization(ctx: RequestContextDto, id: string): Promise<void> {
    const organization = await this.findById(ctx, id);
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    // Read the hostnames first: the delete cascades to them.
    const hostnames = await this.domainHostnames(id);
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(Organization, id);
      // No FK from the platform log, so this row outlives the school.
      await this.platformAudit.record(
        {
          action: AUDIT_ACTIONS.ORGANIZATION_DELETED,
          orgId: id,
          entityType: 'organization',
          entityId: id,
          before: organizationSnapshot(organization),
        },
        manager,
      );
    });
    tenantSlugCache.invalidate(organization.slug);
    hostnames.forEach((h) => tenantDomainCache.invalidate(h));
    this.entitlements.invalidate(id);
    this.logger.log(`Organization "${organization.slug}" deleted`);
  }

  private async domainHostnames(orgId: string): Promise<string[]> {
    const domains = await this.domainRepository.find({
      where: { orgId },
      select: { hostname: true },
    });
    return domains.map((d) => d.hostname);
  }

  /** Drops cached host lookups for an org (e.g. after its status changed). */
  private async invalidateDomainCache(orgId: string): Promise<void> {
    (await this.domainHostnames(orgId)).forEach((h) =>
      tenantDomainCache.invalidate(h),
    );
  }

  private async assertOwner(
    ctx: RequestContextDto,
    orgId: string,
    action: string,
  ): Promise<void> {
    const membership = await this.membershipRepository.findOne({
      where: {
        orgId,
        userId: ctx.user?.id ?? '',
        role: MembershipRole.OWNER,
      },
    });
    if (!membership) {
      throw new ForbiddenException(
        `Only the organization owner or an admin can ${action}`,
      );
    }
  }
}

/** `ERP.Acme-Scl.com.:443` → `erp.acme-scl.com`. */
export function normalizeHostname(host: string): string {
  return host.trim().split(':')[0].toLowerCase().replace(/\.$/, '');
}

/** Escapes `%`, `_` and `\\` for a LIKE pattern. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
