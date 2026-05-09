import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { Product } from './entities/product.entity';

@Injectable()
export class ProductRepository extends BaseTenantRepository<Product> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, Product, 'Product');
  }

  async getStats(): Promise<{
    totalProducts: number;
    totalStock: number;
    totalValue: string;
  }> {
    const result = await this.repo
      .createQueryBuilder('p')
      .select('COUNT(p.id)', 'totalProducts')
      .addSelect('COALESCE(SUM(p.stock), 0)', 'totalStock')
      .addSelect('COALESCE(SUM(p.price * p.stock), 0)', 'totalValue')
      .getRawOne();

    return {
      totalProducts: Number(result.totalProducts),
      totalStock: Number(result.totalStock),
      totalValue: Number(result.totalValue).toFixed(2),
    };
  }
}
