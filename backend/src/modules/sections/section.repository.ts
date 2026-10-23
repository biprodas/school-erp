import { Inject, Injectable } from '@nestjs/common';
import { FindOptionsRelations, FindOptionsWhere } from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { Section } from './entities/section.entity';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { Paginated } from '~/common/dto/paginated.dto';

const RELATIONS: FindOptionsRelations<Section> = {
  schoolClass: true,
  shift: true,
  room: true,
};

@Injectable()
export class SectionRepository extends BaseTenantRepository<Section> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, Section, 'Section');
  }

  findByIdWithRelations(id: string): Promise<Section | null> {
    return this.repo.findOne({ where: { id }, relations: RELATIONS });
  }

  findByName(
    academicYearId: string,
    classId: string,
    name: string,
  ): Promise<Section | null> {
    return this.repo.findOne({ where: { academicYearId, classId, name } });
  }

  findInYear(academicYearId: string): Promise<Section[]> {
    return this.repo.find({
      where: { academicYearId },
      order: { classId: 'ASC', name: 'ASC' },
    });
  }

  countInYear(academicYearId: string): Promise<number> {
    return this.repo.count({ where: { academicYearId } });
  }

  /** Writes columns only (loaded relations would win over changed ids). */
  async updateFields(
    id: string,
    patch: Partial<
      Pick<Section, 'name' | 'shiftId' | 'roomId' | 'capacity' | 'isActive'>
    >,
  ): Promise<void> {
    if (Object.values(patch).every((v) => v === undefined)) return;
    await this.repo.update({ id }, patch);
  }

  findFiltered(
    where: FindOptionsWhere<Section>,
    page: PaginationQueryDto,
  ): Promise<Paginated<Section>> {
    return this.findPage(
      {
        where,
        relations: RELATIONS,
        order: { schoolClass: { level: 'ASC' }, name: 'ASC', id: 'ASC' },
      },
      page,
    );
  }
}
