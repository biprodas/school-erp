import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { OrgSettings } from '../entities/org-settings.entity';

@Injectable()
export class OrgSettingsRepository extends BaseTenantRepository<OrgSettings> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, OrgSettings, 'OrgSettings');
  }

  /** The school's row, if it ever saved a setting (one per org). */
  findCurrent(): Promise<OrgSettings | null> {
    return this.repo.findOne({ where: {} });
  }
}
