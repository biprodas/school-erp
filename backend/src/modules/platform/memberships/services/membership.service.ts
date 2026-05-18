import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestContextDto } from '~/common/dto/request-context.dto';
import { PlatformRole } from 'src/modules/platform/users/enums/platform-role.enum';
import { TenantService } from 'src/modules/platform/tenants/services/tenant.service';
import { UserService } from 'src/modules/platform/users/user.service';
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
  ) {}

  async create(
    ctx: RequestContextDto,
    dto: CreateMembershipDto,
  ): Promise<Membership> {
    await this.assertOwnerOrSuperAdmin(ctx, dto.tenantId);

    if (
      ctx.user?.role !== PlatformRole.SUPER_ADMIN &&
      dto.role === MembershipRole.OWNER
    ) {
      throw new ForbiddenException(
        'Only super admins can create owner memberships',
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

    const membership = this.membershipRepository.create({
      userId: dto.userId,
      tenantId: dto.tenantId,
      role: dto.role ?? MembershipRole.MEMBER,
    });
    return this.membershipRepository.save(membership);
  }

  async findById(ctx: RequestContextDto, id: string): Promise<Membership> {
    const m = await this.membershipRepository.findOne({ where: { id } });
    if (!m) {
      throw new NotFoundException('Membership not found');
    }

    if (ctx.user?.role !== PlatformRole.SUPER_ADMIN) {
      const isOwnMembership = m.userId === ctx.user?.id;
      if (!isOwnMembership) {
        await this.assertOwnerOrSuperAdmin(ctx, m.tenantId);
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

    if (ctx.user?.role === PlatformRole.SUPER_ADMIN) {
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

    await this.assertOwnerOrSuperAdmin(ctx, tenantId);

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
      ctx.user?.role !== PlatformRole.SUPER_ADMIN &&
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

    await this.assertOwnerOrSuperAdmin(ctx, membership.tenantId);

    if (ctx.user?.role !== PlatformRole.SUPER_ADMIN) {
      if (membership.role === MembershipRole.OWNER) {
        throw new ForbiddenException('Cannot modify an owner membership');
      }
      if (dto.role === MembershipRole.OWNER) {
        throw new ForbiddenException(
          'Only super admins can assign the owner role',
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

    await this.assertOwnerOrSuperAdmin(ctx, membership.tenantId);

    if (
      ctx.user?.role !== PlatformRole.SUPER_ADMIN &&
      membership.role === MembershipRole.OWNER
    ) {
      throw new ForbiddenException('Cannot remove an owner membership');
    }

    await this.membershipRepository.delete(id);
  }

  private async assertOwnerOrSuperAdmin(
    ctx: RequestContextDto,
    tenantId: string,
  ): Promise<void> {
    if (ctx.user?.role === PlatformRole.SUPER_ADMIN) return;

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
