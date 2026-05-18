import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { User } from './entities/user.entity';

export interface UserFilters {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

@Injectable()
export class UserRepository extends BaseTenantRepository<User> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, User, 'User');
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email } });
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.repo.findOne({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        firstName: true,
        lastName: true,
        status: true,
      },
    });
  }

  async findFiltered(where: Record<string, any>): Promise<User[]> {
    return this.repo.find({ where });
  }

  /** Returns users that have the given role assigned, with optional filters. */
  async findByRoleId(
    roleId: string,
    filters: UserFilters = {},
  ): Promise<User[]> {
    const qb = this.repo
      .createQueryBuilder('user')
      .innerJoin('user.userRoles', 'userRole')
      .where('userRole.role_id = :roleId', { roleId });

    if (filters.id) {
      qb.andWhere('user.id = :id', { id: filters.id });
    }
    if (filters.email) {
      qb.andWhere('user.email = :email', { email: filters.email });
    }
    if (filters.firstName) {
      qb.andWhere('user.first_name = :firstName', {
        firstName: filters.firstName,
      });
    }
    if (filters.lastName) {
      qb.andWhere('user.last_name = :lastName', {
        lastName: filters.lastName,
      });
    }

    return qb.getMany();
  }
}
