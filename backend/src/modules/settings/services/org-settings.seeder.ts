import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { OrgSettings } from '../entities/org-settings.entity';

/**
 * Creates a new school's (empty) `org_settings` row inside the
 * organization's creation transaction, so settings writes only ever update
 * an existing row. Empty sections mean "all defaults".
 */
@Injectable()
export class OrgSettingsSeeder {
  async createRow(manager: EntityManager, orgId: string): Promise<void> {
    await manager
      .createQueryBuilder()
      .insert()
      .into(OrgSettings)
      .values({ orgId })
      .orIgnore()
      .execute();
  }
}
