import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { OrganizationDomain } from '../entities/organization-domain.entity';

/** The current school's custom domains (org-scoped, under RLS). */
@Injectable()
export class OrganizationDomainRepository extends BaseTenantRepository<OrganizationDomain> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, OrganizationDomain, 'Domain');
  }

  findAllOrdered(): Promise<OrganizationDomain[]> {
    return this.repo.find({
      order: { isPrimary: 'DESC', createdAt: 'ASC' },
    });
  }

  findByHostname(hostname: string): Promise<OrganizationDomain | null> {
    return this.repo.findOne({ where: { hostname } });
  }

  /** Clears the school's primary flag (before setting a new one). */
  async clearPrimary(): Promise<void> {
    await this.repo.update({ isPrimary: true }, { isPrimary: false });
  }
}
