import { Inject, Injectable } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { Guardian } from '../entities/guardian.entity';
import {
  DEFAULT_PAGE_SIZE,
  PaginationQueryDto,
} from '~/common/dto/pagination-query.dto';
import type { FilterGuardianDto } from '../dto/filter-guardian.dto';
import { Paginated } from '~/common/dto/paginated.dto';

@Injectable()
export class GuardianRepository extends BaseTenantRepository<Guardian> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, Guardian, 'Guardian');
  }

  findByIdWithUser(id: string): Promise<Guardian | null> {
    return this.repo.findOne({ where: { id }, relations: { user: true } });
  }

  /**
   * Guardians of students enrolled in the sections (scoped teachers).
   * Reads the link and enrollment tables by name, read-only.
   */
  async findInSections(
    filter: FilterGuardianDto,
    sectionIds: string[],
  ): Promise<Paginated<Guardian>> {
    const { page = 1, limit = DEFAULT_PAGE_SIZE } = filter;
    if (!sectionIds.length)
      return new Paginated<Guardian>([], 0, { page, limit });
    const qb = this.repo
      .createQueryBuilder('g')
      .where('g.org_id = :orgId', { orgId: this.orgId })
      .andWhere(
        `EXISTS (SELECT 1 FROM "student_guardians" sg
          JOIN "student_enrollments" e ON e.student_id = sg.student_id
          WHERE sg.guardian_id = g.id AND sg.org_id = :orgId
            AND e.org_id = :orgId AND e.section_id IN (:...sectionIds))`,
        { sectionIds },
      );
    if (filter.id) qb.andWhere('g.id = :id', { id: filter.id });
    if (filter.name) qb.andWhere('g.name = :name', { name: filter.name });
    const [items, total] = await qb
      .orderBy('g.created_at', 'DESC')
      .addOrderBy('g.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return new Paginated(items, total, { page, limit });
  }

  findByPhone(phone: string): Promise<Guardian | null> {
    return this.repo.findOne({ where: { phone } });
  }

  /** Writes columns only. */
  async updateFields(
    id: string,
    patch: Partial<Omit<Guardian, 'user' | 'links'>>,
  ): Promise<void> {
    if (Object.values(patch).every((v) => v === undefined)) return;
    await this.repo.update({ id }, patch);
  }

  findByUserId(userId: string): Promise<Guardian | null> {
    return this.repo.findOne({ where: { userId } });
  }

  findFiltered(
    where: FindOptionsWhere<Guardian>,
    page: PaginationQueryDto,
  ): Promise<Paginated<Guardian>> {
    return this.findPage(
      {
        where,
        relations: { user: true },
        order: { createdAt: 'DESC' },
      },
      page,
    );
  }
}
