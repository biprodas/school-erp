import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { GradingSystem } from '../entities/grading-system.entity';

@Injectable()
export class GradingSystemRepository extends BaseTenantRepository<GradingSystem> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, GradingSystem, 'GradingSystem');
  }

  findWithItems(id: string): Promise<GradingSystem | null> {
    return this.repo.findOne({
      where: { id },
      relations: { items: true },
      order: { items: { sortOrder: 'ASC' } },
    });
  }

  findAllWithItems(): Promise<GradingSystem[]> {
    return this.repo.find({
      relations: { items: true },
      order: { name: 'ASC', items: { sortOrder: 'ASC' } },
    });
  }

  findByName(name: string): Promise<GradingSystem | null> {
    return this.repo.findOne({ where: { name } });
  }

  findDefault(): Promise<GradingSystem | null> {
    return this.repo.findOne({ where: { isDefault: true } });
  }

  findByTemplate(templateCode: string): Promise<GradingSystem | null> {
    return this.repo.findOne({ where: { templateCode } });
  }

  async clearDefault(): Promise<void> {
    await this.repo.update({ isDefault: true }, { isDefault: false });
  }

  async updateFields(
    id: string,
    patch: Partial<Pick<GradingSystem, 'name' | 'rules' | 'isDefault'>>,
  ): Promise<void> {
    const defined = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(defined).length) await this.repo.update({ id }, defined);
  }
}
