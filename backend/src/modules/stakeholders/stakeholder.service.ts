import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RoleService } from '~/modules/rbac/services/role.service';
import { OrgUserService } from '~/modules/users/services/org-user.service';
import { CreateStakeholderDto } from './dto/create-stakeholder.dto';
import { FilterStakeholderDto } from './dto/filter-stakeholder.dto';
import { UpdateStakeholderDto } from './dto/update-stakeholder.dto';
import { Stakeholder } from './entities/stakeholder.entity';
import { StakeholderStatus } from './enums/stakeholder-status.enum';
import { StakeholderRepository } from './stakeholder.repository';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { Paginated } from '~/common/dto/paginated.dto';

const STAKEHOLDER_ROLE_NAME = 'stakeholder';

@Injectable()
export class StakeholderService {
  private readonly logger = new Logger(StakeholderService.name);

  constructor(
    private readonly stakeholderRepo: StakeholderRepository,
    private readonly userService: OrgUserService,
    private readonly roleService: RoleService,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  findFiltered(filter: FilterStakeholderDto): Promise<Paginated<Stakeholder>> {
    const where: Record<string, any> = {};
    if (filter.id) where.id = filter.id;
    if (filter.type) where.type = filter.type;
    if (filter.status) where.status = filter.status;
    if (filter.organization) where.organization = filter.organization;
    if (filter.userId) where.userId = filter.userId;
    return this.stakeholderRepo.findFiltered(where, filter);
  }

  async findById(id: string): Promise<Stakeholder> {
    const stakeholder = await this.stakeholderRepo.findByIdWithUser(id);
    if (!stakeholder) {
      throw new NotFoundException(`Stakeholder with id "${id}" not found`);
    }
    return stakeholder;
  }

  create(dto: CreateStakeholderDto): Promise<Stakeholder> {
    return this.ds.runInTransaction(async () => {
      if (dto.userId && dto.createUser) {
        throw new BadRequestException(
          'Provide either userId or createUser, not both',
        );
      }

      let userId: string | null = null;

      if (dto.userId) {
        await this.userService.findById(dto.userId);
        const linked = await this.stakeholderRepo.findByUserId(dto.userId);
        if (linked) {
          throw new ConflictException(
            'User is already linked to another stakeholder',
          );
        }
        userId = dto.userId;
      } else if (dto.createUser) {
        const role = await this.roleService.findSystemRole(
          STAKEHOLDER_ROLE_NAME,
        );
        const newUser = await this.userService.create({
          name: dto.name,
          email: dto.createUser.email,
          password: dto.createUser.password,
          roleIds: [role.id],
        });
        userId = newUser.id;
      }

      const stakeholder = await this.stakeholderRepo.saveNew({
        name: dto.name,
        type: dto.type,
        organization: dto.organization ?? null,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        address: dto.address ?? null,
        notes: dto.notes ?? null,
        status: dto.status ?? StakeholderStatus.ACTIVE,
        userId,
      });

      return this.findById(stakeholder.id);
    });
  }

  async update(id: string, dto: UpdateStakeholderDto): Promise<Stakeholder> {
    const stakeholder = await this.findById(id);

    if (dto.userId && dto.userId !== stakeholder.userId) {
      await this.userService.findById(dto.userId);
      const linked = await this.stakeholderRepo.findByUserId(dto.userId);
      if (linked && linked.id !== id) {
        throw new ConflictException(
          'User is already linked to another stakeholder',
        );
      }
    }

    Object.assign(stakeholder, dto);
    await this.stakeholderRepo.save(stakeholder);
    return this.findById(id);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.stakeholderRepo.deleteById(id);
  }
}
