import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '~/tenancy/tenant-connection.service';
import { OrgSettings } from '../entities/org-settings.entity';
import { deepFreeze, settingsCache } from '../settings.cache';
import { withDefaults } from '../settings.defaults';
import type { OrgSettingsValues } from '../settings.types';

/**
 * A school's settings for code outside its requests (singletons such as
 * `SessionService`). Reads through a tenant-pool connection scoped to the
 * school, so RLS applies, and shares the in-memory cache with
 * `SettingsService`. Inside a request, use `SettingsService` instead.
 */
@Injectable()
export class OrgSettingsReader {
  constructor(private readonly connections: TenantConnectionService) {}

  async get(orgId: string): Promise<OrgSettingsValues> {
    const cached = settingsCache.get(orgId);
    if (cached) return cached;
    const generation = settingsCache.generation(orgId);
    const ds = await this.connections.getScopedConnection(orgId);
    try {
      const row = await ds
        .getRepository(OrgSettings)
        .findOne({ where: { orgId } });
      const value = deepFreeze(withDefaults(row ?? {}));
      settingsCache.set(orgId, value, generation);
      return value;
    } finally {
      await ds.release();
    }
  }
}
