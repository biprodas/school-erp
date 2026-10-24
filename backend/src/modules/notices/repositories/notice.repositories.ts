import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { Notice, NoticeRead } from '../entities/notice.entity';

@Injectable()
export class NoticeRepository extends BaseTenantRepository<Notice> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, Notice, 'Notice');
  }

  async updateFields(id: string, patch: Partial<Notice>): Promise<void> {
    const defined = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(defined).length) await this.repo.update({ id }, defined);
  }
}

@Injectable()
export class NoticeReadRepository extends BaseTenantRepository<NoticeRead> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, NoticeRead, 'NoticeRead');
  }

  /** Records a read once (a second read keeps the first time). */
  async markRead(noticeId: string, userId: string): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(NoticeRead)
      .values({ orgId: this.orgId, noticeId, userId })
      .orIgnore()
      .execute();
  }
}
