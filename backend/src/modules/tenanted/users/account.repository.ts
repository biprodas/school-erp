import { Inject, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { User } from '~/platform/users/entities/user.entity';

const WITH_PASSWORD = {
  id: true,
  email: true,
  password: true,
  name: true,
  status: true,
  emailVerifiedAt: true,
} as const;

/**
 * Global user accounts (the shared `users` table) as seen from a tenant
 * request. Accounts are not org-scoped — membership in the current org is
 * checked through `MemberRepository` — so only use this for identity
 * operations (login, password, email verification) or for users already
 * known to be members.
 */
@Injectable()
export class AccountRepository extends BaseTenantRepository<User> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, User, 'User');
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email } });
  }

  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email }, select: WITH_PASSWORD });
  }

  findByIdWithPassword(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id }, select: WITH_PASSWORD });
  }

  findByIds(ids: string[]): Promise<User[]> {
    if (!ids.length) return Promise.resolve([]);
    return this.repo.find({ where: { id: In(ids) } });
  }
}
