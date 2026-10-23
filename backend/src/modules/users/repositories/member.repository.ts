import { Inject, Injectable } from '@nestjs/common';
import { FindOptionsWhere, In } from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { Membership } from '~/modules/memberships/entities/membership.entity';

export interface MemberFilters {
  userId?: string;
  userIds?: string[];
  name?: string;
  email?: string;
}

/** Memberships of the current organization, with the user account joined. */
@Injectable()
export class MemberRepository extends BaseTenantRepository<Membership> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, Membership, 'Member');
  }

  count(): Promise<number> {
    return this.repo.count();
  }

  findByUserId(userId: string): Promise<Membership | null> {
    return this.repo.findOne({ where: { userId }, relations: { user: true } });
  }

  findFiltered(filters: MemberFilters = {}): Promise<Membership[]> {
    const where: FindOptionsWhere<Membership> = {};
    if (filters.userIds) where.userId = In(filters.userIds);
    if (filters.userId) where.userId = filters.userId;
    if (filters.name || filters.email) {
      where.user = {
        ...(filters.name ? { name: filters.name } : {}),
        ...(filters.email ? { email: filters.email } : {}),
      };
    }
    return this.repo.find({
      where,
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });
  }
}
