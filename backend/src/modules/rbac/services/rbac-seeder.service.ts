import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Role } from '../entities/role.entity';
import { SYSTEM_ROLES } from '../system-roles.seed';

/**
 * Seeds the standard school roles for an organization. Invoked when an
 * organization is created, inside the creation transaction (so `manager` is
 * the owner connection, unaffected by row-level security). Idempotent —
 * re-running leaves any existing roles untouched, so it is safe for
 * back-filling old organizations.
 */
@Injectable()
export class RbacSeederService {
  private readonly logger = new Logger(RbacSeederService.name);

  async seedSystemRoles(manager: EntityManager, orgId: string): Promise<void> {
    const repo = manager.getRepository(Role);
    let created = 0;
    for (const def of SYSTEM_ROLES) {
      const existing = await repo.findOne({ where: { orgId, name: def.name } });
      if (existing) {
        continue;
      }
      await repo.save(
        repo.create({
          orgId,
          name: def.name,
          description: def.description,
          scope: def.scope,
          permissions: [...def.permissions],
          isSystem: true,
        }),
      );
      created += 1;
    }
    this.logger.log(
      `System roles seeded for organization ${orgId} (${created} created)`,
    );
  }
}
