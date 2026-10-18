import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Not, Repository, FindOptionsWhere } from 'typeorm';
import { RequestContextDto } from '~/common/dto/request-context.dto';
import {
  OwnerActivation,
  OrganizationService,
} from '~/modules/organizations/services/organization.service';
import { UserService } from '~/modules/users/services/user.service';
import { OwnerProvisioningService } from '~/modules/auth/services/owner-provisioning.service';
import { UserRole } from '~/modules/rbac/entities/user-role.entity';
import { CreateMembershipDto } from '../dto/create-membership.dto';
import { UpdateMembershipRoleDto } from '../dto/update-membership-role.dto';
import { Membership } from '../entities/membership.entity';
import { MembershipRole } from '../enums/membership-role.enum';
import { FilterMembershipDto } from '../dto/filter-membership.dto';

@Injectable()
export class MembershipService {
  constructor(
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly organizationService: OrganizationService,
    private readonly userService: UserService,
    private readonly ownerProvisioning: OwnerProvisioningService,
  ) {}

  async create(
    ctx: RequestContextDto,
    dto: CreateMembershipDto,
  ): Promise<{ membership: Membership; ownerActivation?: OwnerActivation }> {
    await this.assertOwnerOrAdmin(ctx, dto.orgId);

    if (!ctx.user?.isAdmin && dto.role === MembershipRole.OWNER) {
      throw new ForbiddenException('Only admins can create owner memberships');
    }

    const organization = await this.organizationService.findById(
      ctx,
      dto.orgId,
    );
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const user = await this.userService.findById(ctx, dto.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const existing = await this.membershipRepository.findOne({
      where: { userId: dto.userId, orgId: dto.orgId },
    });
    if (existing) {
      throw new ConflictException(
        'Membership already exists for this user and organization',
      );
    }

    if (dto.role === MembershipRole.OWNER) {
      const currentOwner = await this.membershipRepository.findOne({
        where: { orgId: dto.orgId, role: MembershipRole.OWNER },
      });
      if (currentOwner) {
        throw new ConflictException(
          'Organization already has an owner; use the transfer-ownership endpoint instead',
        );
      }

      // OWNER: school admin + activation link (pending until activated),
      // written atomically.
      const { membership, token } = await this.dataSource.transaction(
        async (manager) => {
          const { token } = await this.ownerProvisioning.provisionOwner(
            manager,
            { orgId: dto.orgId, userId: dto.userId },
          );
          const membership = await manager.findOneOrFail(Membership, {
            where: { orgId: dto.orgId, userId: dto.userId },
          });
          return { membership, token };
        },
      );
      await this.ownerProvisioning.sendActivationEmail(
        user,
        organization.slug,
        token,
      );
      const ownerActivation: OwnerActivation = {
        token,
        orgSlug: organization.slug,
      };
      return { membership, ownerActivation };
    }

    const membership = await this.membershipRepository.save(
      this.membershipRepository.create({
        userId: dto.userId,
        orgId: dto.orgId,
        role: dto.role ?? MembershipRole.MEMBER,
        isAdmin: dto.role === MembershipRole.ADMIN,
      }),
    );

    return { membership };
  }

  async findById(ctx: RequestContextDto, id: string): Promise<Membership> {
    const m = await this.membershipRepository.findOne({ where: { id } });
    if (!m) {
      throw new NotFoundException('Membership not found');
    }

    if (!ctx.user?.isAdmin) {
      const isOwnMembership = m.userId === ctx.user?.id;
      if (!isOwnMembership) {
        await this.assertOwnerOrAdmin(ctx, m.orgId);
      }
    }

    return m;
  }

  async findAll(
    ctx: RequestContextDto,
    dto: FilterMembershipDto,
  ): Promise<Membership[]> {
    const { userId, orgId } = dto;

    const reqQuery: FindOptionsWhere<Membership> = {};
    if (userId) reqQuery.userId = userId;
    if (orgId) reqQuery.orgId = orgId;

    if (ctx.user?.isAdmin === true) {
      return this.membershipRepository.find({
        where: reqQuery,
        order: { createdAt: 'ASC' },
      });
    }

    const currentUserId = ctx.user?.id;
    if (userId && userId !== currentUserId) {
      throw new ForbiddenException('You can only view your own memberships');
    }

    return this.membershipRepository.find({
      where: { ...reqQuery, userId: currentUserId! },
      order: { createdAt: 'ASC' },
    });
  }

  async findByOrgId(
    ctx: RequestContextDto,
    orgId: string,
  ): Promise<Membership[]> {
    const organization = await this.organizationService.findById(ctx, orgId);
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    await this.assertOwnerOrAdmin(ctx, orgId);

    return this.membershipRepository.find({
      where: { orgId },
      order: { createdAt: 'ASC' },
    });
  }

  async findByUserId(
    ctx: RequestContextDto,
    userId: string,
  ): Promise<Membership[]> {
    if (!ctx.user?.isAdmin && userId !== ctx.user?.id) {
      throw new ForbiddenException('You can only view your own memberships');
    }

    const user = await this.userService.findById(ctx, userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.membershipRepository.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
  }

  async updateRole(
    ctx: RequestContextDto,
    id: string,
    dto: UpdateMembershipRoleDto,
  ): Promise<Membership> {
    const membership = await this.membershipRepository.findOne({
      where: { id },
    });
    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    await this.assertOwnerOrAdmin(ctx, membership.orgId);

    if (!ctx.user?.isAdmin) {
      if (membership.role === MembershipRole.OWNER) {
        throw new ForbiddenException('Cannot modify an owner membership');
      }
      if (dto.role === MembershipRole.OWNER) {
        throw new ForbiddenException('Only admins can assign the owner role');
      }
    }

    if (
      dto.role === MembershipRole.OWNER &&
      membership.role !== MembershipRole.OWNER
    ) {
      const otherOwner = await this.membershipRepository.findOne({
        where: {
          orgId: membership.orgId,
          role: MembershipRole.OWNER,
          id: Not(membership.id),
        },
      });
      if (otherOwner) {
        throw new ConflictException(
          'Organization already has an owner; use the transfer-ownership endpoint instead',
        );
      }
    }

    membership.role = dto.role;
    // Owners and admins administer the school; members don't.
    membership.isAdmin = dto.role !== MembershipRole.MEMBER;
    return this.membershipRepository.save(membership);
  }

  async remove(ctx: RequestContextDto, id: string): Promise<void> {
    const membership = await this.membershipRepository.findOne({
      where: { id },
    });
    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    await this.assertOwnerOrAdmin(ctx, membership.orgId);

    if (!ctx.user?.isAdmin && membership.role === MembershipRole.OWNER) {
      throw new ForbiddenException('Cannot remove an owner membership');
    }

    // Leaving the org also drops the roles the user held in it.
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(Membership, id);
      await manager.delete(UserRole, {
        orgId: membership.orgId,
        userId: membership.userId,
      });
    });
  }

  private async assertOwnerOrAdmin(
    ctx: RequestContextDto,
    orgId: string,
  ): Promise<void> {
    if (ctx.user?.isAdmin === true) return;

    const ownership = await this.membershipRepository.findOne({
      where: {
        orgId,
        userId: ctx.user?.id ?? '',
        role: MembershipRole.OWNER,
      },
    });
    if (!ownership) {
      throw new ForbiddenException('Access denied');
    }
  }
}
