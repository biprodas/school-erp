import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { Employee } from './entities/employee.entity';

const RELATIONS = ['department', 'designation', 'user'];

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

  findFiltered(where: Record<string, any>): Promise<Employee[]> {
    return this.repo.find({
      where,
      relations: RELATIONS,
      order: { createdAt: 'DESC' },
    });
  }
}
