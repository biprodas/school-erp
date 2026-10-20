import { Inject, Injectable } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { Paginated } from '~/common/dto/paginated.dto';
import { AuditLog } from '../entities/audit-log.entity';

/**
 * Insert and read only: the app role has no UPDATE or DELETE on
 * `audit_logs`, so nothing here edits a row.
 */
@Injectable()
export class AuditLogRepository extends BaseTenantRepository<AuditLog> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, AuditLog, 'AuditLog');
  }

  findFiltered(
    where: FindOptionsWhere<AuditLog>,
    page: PaginationQueryDto,
  ): Promise<Paginated<AuditLog>> {
    return this.findPage({ where, order: { createdAt: 'DESC' } }, page);
  }
}
