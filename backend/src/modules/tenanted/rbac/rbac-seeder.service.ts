import { Injectable, Logger } from '@nestjs/common';
import { TenantConnectionService } from '~/tenancy/tenant-connection.service';
import { Role } from './entities/role.entity';
import { SYSTEM_ROLES } from './system-roles.seed';

/**
 * Seeds the standard school roles into a tenant schema. Invoked when a tenant
 * is created (after its schema tables exist). Idempotent — re-running leaves
 * any existing roles untouched, so it is safe for back-filling old tenants.
 */
@Injectable()
export class RbacSeederService {
  private readonly logger = new Logger(RbacSeederService.name);

  constructor(
    private readonly tenantConnectionService: TenantConnectionService,
  ) {}

  async seedSystemRoles(schemaName: string): Promise<void> {
    const proxy =
      await this.tenantConnectionService.getScopedConnection(schemaName);
    try {
      const repo = proxy.getRepository(Role);
      let created = 0;
      for (const def of SYSTEM_ROLES) {
        const existing = await repo.findOne({ where: { name: def.name } });
        if (existing) {
          continue;
        }
        await repo.save(
          repo.create({
            name: def.name,
            description: def.description,
            permissions: [...def.permissions],
            isSystem: true,
          }),
        );
        created += 1;
      }
      this.logger.log(
        `System roles seeded for schema ${schemaName} (${created} created)`,
      );
    } finally {
      await proxy.release();
    }
  }
}
