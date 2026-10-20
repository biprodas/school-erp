import {
  BadRequestException,
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Organization } from '../entities/organization.entity';
import { OrganizationDomain } from '../entities/organization-domain.entity';
import { RESOLVABLE_DOMAIN_STATUSES } from '../enums/domain-status.enum';
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
import { RequestContextDto } from '~/common/dto/request-context.dto';
import { PlatformAuditService } from '~/modules/audit/services/platform-audit.service';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';

/** What the platform audit log keeps of an organization. */
function organizationSnapshot(org: Organization) {
  return { name: org.name, slug: org.slug, status: org.status, type: org.type };
}

/** One-time owner activation handed back when an owner is (re)provisioned. */
export interface OwnerActivation {
  token: string;
  orgSlug: string;
}

export interface CreateOrganizationResult {
  organization: Organization;
  ownerActivation?: OwnerActivation;
}

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
    @InjectDataSource()
    private dataSource: DataSource,
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
    const isAdmin = user?.isAdmin === true;

    let owner: User | undefined;
    if (isAdmin) {
      if (dto.ownerUserId) {
        // Validate up-front so we never fail half-way through.
        owner = await this.userService.findById(ctx, dto.ownerUserId);
      }
    } else {
      owner = await this.userService.findById(ctx, user?.id ?? '');
    }

    const { ownerUserId: _ownerUserId, ...fields } = dto;

    const { organization, token } = await this.dataSource.transaction(
      async (manager) => {
        const existing = await manager.findOne(Organization, {
          where: { slug: dto.slug },
        });
        if (existing) {
          throw new ConflictException('Organization slug already exists');
        }

        const organization = await manager.save(
          manager.create(Organization, fields),
        );

        // Seed the standard school roles for the new organization.
        await this.rbacSeederService.seedSystemRoles(manager, organization.id);
        // Its settings row, so settings writes only ever update (and lock) it.
        await this.orgSettingsSeeder.createRow(manager, organization.id);

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
   * Atomically reassigns the OWNER membership of an organization to another
   * user, provisioning the new owner (school admin + activation token) in the
   * same transaction so the org never has zero or two OWNERs. Admin-only.
   */
  async transferOwnership(
    ctx: RequestContextDto,
    orgId: string,
    dto: TransferOwnershipDto,
  ): Promise<{ membership: Membership; ownerActivation?: OwnerActivation }> {
    if (!ctx.user?.isAdmin) {
      throw new ForbiddenException(
        'Only admins can transfer organization ownership',
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
   * OWNER or a platform admin.
   */
  async reissueOwnerActivation(
    ctx: RequestContextDto,
    orgId: string,
  ): Promise<OwnerActivation> {
    const organization = await this.organizationRepository.findOne({
      where: { id: orgId },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    if (!ctx.user?.isAdmin) {
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
    return { token, orgSlug: organization.slug };
  }

  async getAllOrganizations(ctx: RequestContextDto): Promise<Organization[]> {
    if (!ctx.user?.isAdmin) {
      return this.getOrganizationsByUser(ctx, ctx.user?.id ?? '');
    }

    return this.organizationRepository.find();
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
   * Returns an organization only if the requester is an admin or has any
   * membership in it.
   */
  async findByIdForUser(
    ctx: RequestContextDto,
    id: string,
  ): Promise<Organization> {
    const organization = await this.findById(ctx, id);
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    if (ctx.user?.isAdmin === true) return organization;

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

    if (!ctx.user?.isAdmin) {
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
