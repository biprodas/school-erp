import { Inject, Injectable } from '@nestjs/common';
import { FindOptionsRelations, FindOptionsWhere } from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { Employee } from './entities/employee.entity';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { Paginated } from '~/common/dto/paginated.dto';

const RELATIONS: FindOptionsRelations<Employee> = {
  department: true,
  designation: true,
  user: true,
};

/** Writable columns (relations and the virtual name excluded). */
export type EmployeePatch = Partial<
  Omit<
    Employee,
    | 'department'
    | 'designation'
    | 'user'
    | 'photoFile'
    | 'fullName'
    | 'syncFullName'
  >
>;

@Injectable()
export class EmployeeRepository extends BaseTenantRepository<Employee> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, Employee, 'Employee');
  }

  findByIdWithRelations(id: string): Promise<Employee | null> {
    return this.repo.findOne({ where: { id }, relations: RELATIONS });
  }

  findByEmployeeNumber(employeeNumber: string): Promise<Employee | null> {
    return this.repo.findOne({ where: { employeeNumber } });
  }

  findByUserId(userId: string): Promise<Employee | null> {
    return this.repo.findOne({ where: { userId } });
  }

  /** Writes columns only (loaded relations would win over changed ids). */
  async updateFields(id: string, patch: EmployeePatch): Promise<void> {
    if (Object.values(patch).every((v) => v === undefined)) return;
    await this.repo.update({ id }, patch);
  }

  findFiltered(
    where: FindOptionsWhere<Employee>,
    page: PaginationQueryDto,
  ): Promise<Paginated<Employee>> {
    return this.findPage(
      {
        where,
        relations: RELATIONS,
        order: { createdAt: 'DESC' },
      },
      page,
    );
  }
}
