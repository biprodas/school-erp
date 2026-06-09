import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { User } from './entities/user.entity';

export interface UserFilters {
  id?: string;
  name?: string;
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
        name: true,
        status: true,
        isAdmin: true,
      },
    });
  }

  async findByIdWithPassword(id: string): Promise<User | null> {
    return this.repo.findOne({
      where: { id },
      select: {
        id: true,
        email: true,
        password: true,
        name: true,
        status: true,
        isAdmin: true,
      },
    });
  }

  async findFiltered(where: Record<string, any>): Promise<User[]> {
    return this.repo.find({
      where,
      relations: { userRoles: { role: true } },
    });
  }

  /** Returns a single user with their assigned roles eager-loaded. */
  async findByIdWithRoles(id: string): Promise<User | null> {
    return this.repo.findOne({
      where: { id },
      relations: { userRoles: { role: true } },
    });
  }

  /** Returns users that have the given role assigned, with optional filters. */
  async findByRoleId(
    roleId: string,
    filters: UserFilters = {},
  ): Promise<User[]> {
    const qb = this.repo
      .createQueryBuilder('user')
      .innerJoin('user.userRoles', 'userRoleFilter')
      .leftJoinAndSelect('user.userRoles', 'userRole')
      .leftJoinAndSelect('userRole.role', 'role')
      .where('userRoleFilter.role_id = :roleId', { roleId });

    if (filters.id) {
      qb.andWhere('user.id = :id', { id: filters.id });
    }
    if (filters.email) {
      qb.andWhere('user.email = :email', { email: filters.email });
    }
    if (filters.name) {
      qb.andWhere('user.name = :name', {
        name: filters.name,
      });
    }

    return qb.getMany();
  }
}
