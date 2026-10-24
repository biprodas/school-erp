import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TenantJobRunner } from '~/tenancy/tenant-job.runner';
import { OPERATIONAL_ORGANIZATION_STATUSES } from '~/modules/organizations/enums/organization-status.enum';
import {
  DISPATCHED_EVENTS,
  EventDispatcherService,
} from './services/event-dispatcher.service';
import { NoticeService } from './services/notice.service';

export const COMMUNICATION_INTERVAL_MS = 60 * 1000;

/**
 * Every minute: publishes scheduled notices that are due and turns the
 * outbox's events into notifications, for each school that has work
 * (found through the root connection), each run as that school.
 */
@Injectable()
export class CommunicationScheduler {
  private readonly logger = new Logger(CommunicationScheduler.name);
  private running = false;

  constructor(
    @InjectDataSource() private readonly root: DataSource,
    private readonly runner: TenantJobRunner,
  ) {}

  @Interval('communication', COMMUNICATION_INTERVAL_MS)
  async handleInterval(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.runOnce(new Date());
    } catch (err) {
      this.logger.error(`Communication run failed: ${String(err)}`);
    } finally {
      this.running = false;
    }
  }

  async runOnce(
    now: Date,
    orgIds?: string[],
  ): Promise<{ orgId: string; notices: number; events: number }[]> {
    const rows = await this.root.query<{ org_id: string }[]>(
      `SELECT DISTINCT w."org_id" FROM (
         SELECT "org_id" FROM "notices"
         WHERE "notified_at" IS NULL AND "publish_at" <= $1
         UNION
         SELECT "org_id" FROM "domain_events"
         WHERE "processed_at" IS NULL AND "type" = ANY($2::text[])
       ) w
       JOIN "organizations" o ON o."id" = w."org_id"
       WHERE o."status"::text = ANY($3::text[])
         AND ($4::uuid[] IS NULL OR w."org_id" = ANY($4::uuid[]))`,
      [
        now,
        [...DISPATCHED_EVENTS],
        [...OPERATIONAL_ORGANIZATION_STATUSES],
        orgIds ?? null,
      ],
    );
    const runs: { orgId: string; notices: number; events: number }[] = [];
    for (const { org_id: orgId } of rows) {
      try {
        runs.push(
          await this.runner.run(orgId, async (resolve) => ({
            orgId,
            notices: await (await resolve(NoticeService)).publishDue(now),
            events: await (await resolve(EventDispatcherService)).process(),
          })),
        );
      } catch (err) {
        this.logger.error(
          `Communication run failed for ${orgId}: ${String(err)}`,
        );
      }
    }
    return runs;
  }
}
