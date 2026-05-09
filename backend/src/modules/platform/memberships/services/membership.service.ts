import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestContextDto } from '~/common/dto/request-context.dto';
import { TenantService } from 'src/modules/platform/tenants/services/tenant.service';
import { UserService } from 'src/modules/platform/users/user.service';
import { CreateMembershipDto } from '../dto/create-membership.dto';
import { UpdateMembershipRoleDto } from '../dto/update-membership-role.dto';
import { Membership } from '../entities/membership.entity';
import { MembershipRole } from '../enums/membership-role.enum';

@Injectable()
export class MembershipService {
  constructor(
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
    private readonly tenantService: TenantService,
    private readonly userService: UserService,
  ) { }

  async create(
    ctx: RequestContextDto,
    dto: CreateMembershipDto,
  ): Promise<Membership> {
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
      throw new ConflictException('Membership already exists for this user and tenant');
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
    return m;
  }

  async findByTenantId(
    ctx: RequestContextDto,
    tenantId: string,
  ): Promise<Membership[]> {
    const tenant = await this.tenantService.findById(ctx, tenantId);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return this.membershipRepository.find({
      where: { tenantId },
      order: { createdAt: 'ASC' },
    });
  }

  async findByUserId(ctx: RequestContextDto, userId: string): Promise<Membership[]> {
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
    const membership = await this.findById(ctx, id);
    membership.role = dto.role;
    return this.membershipRepository.save(membership);
  }

  async remove(ctx: RequestContextDto, id: string): Promise<void> {
    await this.findById(ctx, id);
    await this.membershipRepository.delete(id);
  }
}
