import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { RequestContextDto } from '~/common/dto/request-context.dto';
import { PlatformRole } from 'src/modules/platform/users/enums/platform-role.enum';
import {
  OwnerActivation,
  TenantService,
} from 'src/modules/platform/tenants/services/tenant.service';
import { UserService } from 'src/modules/platform/users/user.service';
import { OwnerProvisioningService } from '~/tenanted/auth/owner-provisioning.service';
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
    private readonly tenantService: TenantService,
    private readonly userService: UserService,
    private readonly ownerProvisioning: OwnerProvisioningService,
  ) {}

  async create(
    ctx: RequestContextDto,
    dto: CreateMembershipDto,
  ): Promise<{ membership: Membership; ownerActivation?: OwnerActivation }> {
    await this.assertOwnerOrAdmin(ctx, dto.tenantId);

    if (
      ctx.user?.role !== PlatformRole.ADMIN &&
      dto.role === MembershipRole.OWNER
    ) {
      throw new ForbiddenException(
        'Only admins can create owner memberships',
      );
    }

    const tenant = await this.tenantService.findById(ctx, dto.tenantId);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const user = await this.userService.findById(ctx, dto.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const existing = await this.membershipRepository.findOne({
      where: { userId: dto.userId, tenantId: dto.tenantId },
    });
    if (existing) {
      throw new ConflictException(
        'Membership already exists for this user and tenant',
      );
    }

    if (dto.role === MembershipRole.OWNER) {
      const currentOwner = await this.membershipRepository.findOne({
        where: { tenantId: dto.tenantId, role: MembershipRole.OWNER },
      });
      if (currentOwner) {
        throw new ConflictException(
          'Tenant already has an owner; use the transfer-ownership endpoint instead',
        );
      }
    }

    const membership = await this.membershipRepository.save(
      this.membershipRepository.create({
        userId: dto.userId,
        tenantId: dto.tenantId,
        role: dto.role ?? MembershipRole.MEMBER,
      }),
    );

    // When assigning an OWNER, provision their tenant-admin user + activation
    // link so they can actually log into the tenant.
    let ownerActivation: OwnerActivation | undefined;
    if (membership.role === MembershipRole.OWNER) {
      const { token } = await this.ownerProvisioning.provisionOwner(
        tenant.schemaName,
        { email: user.email, name: user.name, platformUserId: user.id },
      );
      ownerActivation = { token, tenantSlug: tenant.slug };
    }

    return { membership, ownerActivation };
  }

  async findById(ctx: RequestContextDto, id: string): Promise<Membership> {
    const m = await this.membershipRepository.findOne({ where: { id } });
    if (!m) {
      throw new NotFoundException('Membership not found');
    }

    if (ctx.user?.role !== PlatformRole.ADMIN) {
      const isOwnMembership = m.userId === ctx.user?.id;
      if (!isOwnMembership) {
        await this.assertOwnerOrAdmin(ctx, m.tenantId);
      }
    }

    return m;
  }

  async findAll(
    ctx: RequestContextDto,
    dto: FilterMembershipDto,
  ): Promise<Membership[]> {
    const { userId, tenantId } = dto;

    const reqQuery: any = {};
    if (userId) reqQuery.userId = userId;
    if (tenantId) reqQuery.tenantId = tenantId;

    if (ctx.user?.role === PlatformRole.ADMIN) {
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

  async findByTenantId(
    ctx: RequestContextDto,
    tenantId: string,
  ): Promise<Membership[]> {
    const tenant = await this.tenantService.findById(ctx, tenantId);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    await this.assertOwnerOrAdmin(ctx, tenantId);

    return this.membershipRepository.find({
      where: { tenantId },
      order: { createdAt: 'ASC' },
    });
  }

  async findByUserId(
    ctx: RequestContextDto,
    userId: string,
  ): Promise<Membership[]> {
    if (
      ctx.user?.role !== PlatformRole.ADMIN &&
      userId !== ctx.user?.id
    ) {
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

    await this.assertOwnerOrAdmin(ctx, membership.tenantId);

    if (ctx.user?.role !== PlatformRole.ADMIN) {
      if (membership.role === MembershipRole.OWNER) {
        throw new ForbiddenException('Cannot modify an owner membership');
      }
      if (dto.role === MembershipRole.OWNER) {
        throw new ForbiddenException(
          'Only admins can assign the owner role',
        );
      }
    }

    if (
      dto.role === MembershipRole.OWNER &&
      membership.role !== MembershipRole.OWNER
    ) {
      const otherOwner = await this.membershipRepository.findOne({
        where: {
          tenantId: membership.tenantId,
          role: MembershipRole.OWNER,
          id: Not(membership.id),
        },
      });
      if (otherOwner) {
        throw new ConflictException(
          'Tenant already has an owner; use the transfer-ownership endpoint instead',
        );
      }
    }

    membership.role = dto.role;
    return this.membershipRepository.save(membership);
  }

  async remove(ctx: RequestContextDto, id: string): Promise<void> {
    const membership = await this.membershipRepository.findOne({
      where: { id },
    });
    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    await this.assertOwnerOrAdmin(ctx, membership.tenantId);

    if (
      ctx.user?.role !== PlatformRole.ADMIN &&
      membership.role === MembershipRole.OWNER
    ) {
      throw new ForbiddenException('Cannot remove an owner membership');
    }

    await this.membershipRepository.delete(id);
  }

  private async assertOwnerOrAdmin(
    ctx: RequestContextDto,
    tenantId: string,
  ): Promise<void> {
    if (ctx.user?.role === PlatformRole.ADMIN) return;

    const ownership = await this.membershipRepository.findOne({
      where: {
        tenantId,
        userId: ctx.user?.id ?? '',
        role: MembershipRole.OWNER,
      },
    });
    if (!ownership) {
      throw new ForbiddenException('Access denied');
    }
  }
}
