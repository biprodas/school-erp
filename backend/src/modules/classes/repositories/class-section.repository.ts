import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { ClassSection } from '../entities/class-section.entity';

@Injectable()
export class ClassSectionRepository extends BaseTenantRepository<ClassSection> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, ClassSection, 'ClassSection');
  }

  findByClass(classId: string): Promise<ClassSection[]> {
    return this.repo.find({
      where: { classId },
      relations: ['section'],
      order: { createdAt: 'ASC' },
    });
  }

  findByIdWithSection(id: string): Promise<ClassSection | null> {
    return this.repo.findOne({ where: { id }, relations: ['section'] });
  }

  findLink(classId: string, sectionId: string): Promise<ClassSection | null> {
    return this.repo.findOne({ where: { classId, sectionId } });
  }
}
