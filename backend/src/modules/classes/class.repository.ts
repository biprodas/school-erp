import { Inject, Injectable } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { Class } from './entities/class.entity';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { Paginated } from '~/common/dto/paginated.dto';

@Injectable()
export class ClassRepository extends BaseTenantRepository<Class> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, Class, 'Class');
  }

  findByName(name: string): Promise<Class | null> {
    return this.repo.findOne({ where: { name } });
  }

  findAllOrdered(): Promise<Class[]> {
    return this.repo.find({ order: { level: 'ASC', name: 'ASC', id: 'ASC' } });
  }

  /** Whether any student is enrolled in the class, in any session. */
  hasEnrollments(id: string): Promise<boolean> {
    return this.repo
      .createQueryBuilder('c')
      .where('c.id = :id', { id })
      .andWhere('c.orgId = :orgId', { orgId: this.orgId })
      .andWhere(
        'EXISTS (SELECT 1 FROM student_enrollments e WHERE e.class_id = c.id)',
      )
      .getExists();
  }

  findFiltered(
    where: FindOptionsWhere<Class>,
    page: PaginationQueryDto,
  ): Promise<Paginated<Class>> {
    return this.findPage({ where, order: { level: 'ASC', name: 'ASC' } }, page);
  }
}
