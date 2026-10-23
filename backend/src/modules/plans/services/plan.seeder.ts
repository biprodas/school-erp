import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { DbConfig } from '~/config';
import { Plan } from '../entities/plan.entity';
import { DEFAULT_PLANS } from '../plans.catalog';

/**
 * Dev bootstrap: with `DB_SYNC=true` the schema is synchronized instead of
 * migrated, so the plan rows the `PlansAndOnboarding` migration inserts
 * would be missing. Inserts the default plans that don't exist; never
 * changes an existing row.
 */
@Injectable()
export class PlanSeeder implements OnModuleInit {
  private readonly logger = new Logger(PlanSeeder.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.get<DbConfig>('db')?.sync) return;
    const inserted = await this.seedMissing();
    if (inserted) this.logger.log(`Seeded ${inserted} default plan(s)`);
  }

  async seedMissing(): Promise<number> {
    const result = await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(Plan)
      .values(
        DEFAULT_PLANS.map((p) => ({
          code: p.code,
          name: p.name,
          pricePerStudent: p.pricePerStudent,
          minFee: p.minFee,
          modules: p.modules,
          limits: p.limits,
          sortOrder: p.sortOrder,
        })),
      )
      .orIgnore()
      .execute();
    return result.identifiers.filter(Boolean).length;
  }
}
