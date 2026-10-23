import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { DbConfig } from '~/config';
import {
  BD_DISTRICTS,
  BD_DIVISIONS,
  BD_UPAZILAS,
} from '~/shared/geo/bd-geo.data';
import { GeoDistrict } from './entities/geo-district.entity';
import { GeoDivision } from './entities/geo-division.entity';
import { GeoUpazila } from './entities/geo-upazila.entity';

/**
 * Fills the `geo_*` tables on boot when the schema is synchronized (dev,
 * e2e); production gets them from the `StudentProfileAndGeo` migration.
 * Inserts only missing ids, so it never changes existing rows.
 */
@Injectable()
export class GeoSeeder implements OnModuleInit {
  private readonly logger = new Logger(GeoSeeder.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.get<DbConfig>('db')?.sync) return;
    const inserted = await this.seedMissing();
    if (inserted) this.logger.log(`Seeded ${inserted} geo unit(s)`);
  }

  async seedMissing(): Promise<number> {
    let inserted = 0;
    const insert = async (
      entity: typeof GeoDivision | typeof GeoDistrict | typeof GeoUpazila,
      parent: 'divisionId' | 'districtId' | null,
      rows: typeof BD_DIVISIONS,
    ) => {
      const result = await this.dataSource
        .createQueryBuilder()
        .insert()
        .into(entity)
        .values(
          rows.map(([id, parentId, name, nameBn]) => ({
            id,
            name,
            nameBn,
            ...(parent ? { [parent]: parentId } : {}),
          })),
        )
        .orIgnore()
        .execute();
      inserted += result.identifiers.filter(Boolean).length;
    };
    await insert(GeoDivision, null, BD_DIVISIONS);
    await insert(GeoDistrict, 'divisionId', BD_DISTRICTS);
    await insert(GeoUpazila, 'districtId', BD_UPAZILAS);
    return inserted;
  }
}
