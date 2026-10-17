import { Inject, Injectable } from '@nestjs/common';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { AddressType } from '../enums/address-type.enum';
import { StudentAddress } from '../entities/student-address.entity';

@Injectable()
export class StudentAddressRepository extends BaseTenantRepository<StudentAddress> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, StudentAddress, 'StudentAddress');
  }

  findByStudent(studentId: string): Promise<StudentAddress[]> {
    return this.repo.find({
      where: { studentId },
      order: { addressType: 'ASC' },
    });
  }

  findByType(
    studentId: string,
    addressType: AddressType,
  ): Promise<StudentAddress | null> {
    return this.repo.findOne({ where: { studentId, addressType } });
  }
}
