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

  /** The school's row (one per org, created with the organization). */
  findCurrent(): Promise<OrgSettings | null> {
    return this.repo.findOne({ where: {} });
  }

  /**
   * The row locked until the surrounding transaction ends, so concurrent
   * settings writes of the school run one after the other. Creates it first
   * if it's missing (a school created before rows came with organizations
   * and not yet back-filled); a concurrent create is ignored, not a 409.
   */
  async findCurrentForUpdate(): Promise<OrgSettings> {
    const lock = { mode: 'pessimistic_write' } as const;
    const row = await this.repo.findOne({ where: {}, lock });
    if (row) return row;
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(OrgSettings)
      .values({ orgId: this.orgId })
      .orIgnore()
      .execute();
    return this.repo.findOneOrFail({ where: {}, lock });
  }
}
