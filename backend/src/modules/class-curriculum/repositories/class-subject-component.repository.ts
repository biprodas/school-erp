import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { ClassSubjectComponent } from '../entities/class-subject-component.entity';
import { SubjectComponent } from '../enums/subject-component.enum';

@Injectable()
export class ClassSubjectComponentRepository extends BaseTenantRepository<ClassSubjectComponent> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, ClassSubjectComponent, 'ClassSubjectComponent');
  }

  findByClassSubject(classSubjectId: string): Promise<ClassSubjectComponent[]> {
    return this.repo.find({
      where: { classSubjectId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  findByComponent(
    classSubjectId: string,
    component: SubjectComponent,
  ): Promise<ClassSubjectComponent | null> {
    return this.repo.findOne({ where: { classSubjectId, component } });
  }
}
