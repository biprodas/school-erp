import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { Role } from './entities/role.entity';

@Injectable()
export class RoleRepository extends BaseTenantRepository<Role> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, Role, 'Role');
  }

  findByName(name: string): Promise<Role | null> {
    return this.repo.findOne({ where: { name } });
  }
}
