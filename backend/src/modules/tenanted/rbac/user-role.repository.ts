import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { UserRole } from './entities/user-role.entity';

@Injectable()
export class UserRoleRepository extends BaseTenantRepository<UserRole> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, UserRole, 'UserRole');
  }

  /** All assignments for a user, with the related role eagerly loaded. */
  findByUserId(userId: string): Promise<UserRole[]> {
    return this.repo.find({ where: { userId }, relations: { role: true } });
  }

  findByRoleId(roleId: string): Promise<UserRole[]> {
    return this.repo.find({ where: { roleId } });
  }

  findAssignment(userId: string, roleId: string): Promise<UserRole | null> {
    return this.repo.findOne({ where: { userId, roleId } });
  }

  countByRoleId(roleId: string): Promise<number> {
    return this.repo.count({ where: { roleId } });
  }

  /** Idempotently assigns a role to a user. */
  async assign(userId: string, roleId: string): Promise<UserRole> {
    const existing = await this.findAssignment(userId, roleId);
    if (existing) {
      return existing;
    }
    return this.saveNew({ userId, roleId });
  }

  async unassign(userId: string, roleId: string): Promise<void> {
    await this.repo.delete({ userId, roleId });
  }
}
