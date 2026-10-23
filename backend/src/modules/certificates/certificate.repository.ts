import { Inject, Injectable } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { Paginated } from '~/common/dto/paginated.dto';
import { Certificate } from './entities/certificate.entity';

@Injectable()
export class CertificateRepository extends BaseTenantRepository<Certificate> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, Certificate, 'Certificate');
  }

  findFiltered(
    where: FindOptionsWhere<Certificate>,
    page: PaginationQueryDto,
  ): Promise<Paginated<Certificate>> {
    return this.findPage(
      { where, order: { issuedAt: 'DESC', id: 'ASC' } },
      page,
    );
  }
}
