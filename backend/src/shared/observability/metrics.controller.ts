import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { DataSource } from 'typeorm';
import { RawResponse } from '~/common/decorators/response.decorators';
import { JobQueue } from '~/shared/queue';

const line = (
  name: string,
  value: number,
  labels: Record<string, string> = {},
) => {
  const l = Object.entries(labels)
    .map(([k, v]) => `${k}="${v.replace(/["\\\n]/g, '_')}"`)
    .join(',');
  return `${name}${l ? `{${l}}` : ''} ${Number.isFinite(value) ? value : 0}`;
};

/**
 * Prometheus metrics (PRD 8.8): queue depth per state, job outcomes and
 * failed emails over the last 24 hours, and process health. Off (404)
 * unless `METRICS_TOKEN` is set; scrapers send it as a bearer token.
 */
@ApiExcludeController()
@SkipThrottle()
@RawResponse()
@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly queue: JobQueue,
    @InjectDataSource() private readonly root: DataSource,
  ) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4')
  async metrics(@Req() req: Request): Promise<string> {
    const token = process.env.METRICS_TOKEN?.trim();
    if (!token) throw new NotFoundException();
    const given = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    const a = Buffer.from(given);
    const b = Buffer.from(token);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException();
    }

    const out: string[] = [
      '# HELP school_erp_queue_jobs Jobs per queue and state.',
      '# TYPE school_erp_queue_jobs gauge',
    ];
    for (const s of await this.queue.stats()) {
      for (const state of ['waiting', 'active', 'delayed', 'failed'] as const) {
        out.push(
          line('school_erp_queue_jobs', s[state], { queue: s.queue, state }),
        );
      }
    }

    const jobs = await this.root.query<
      { type: string; status: string; n: number }[]
    >(
      `SELECT "type", "status", count(*)::int AS n FROM "jobs"
       WHERE "created_at" > now() - interval '24 hours' GROUP BY "type", "status"`,
    );
    out.push(
      '# HELP school_erp_jobs_24h Tracked jobs created in the last 24 hours, by type and status.',
      '# TYPE school_erp_jobs_24h gauge',
      ...jobs.map((j) =>
        line('school_erp_jobs_24h', j.n, { type: j.type, status: j.status }),
      ),
    );

    const deliveries = await this.root.query<
      { channel: string; status: string; n: number }[]
    >(
      `SELECT "channel", "status", count(*)::int AS n FROM "delivery_logs"
       WHERE "created_at" > now() - interval '24 hours' GROUP BY "channel", "status"`,
    );
    out.push(
      '# HELP school_erp_deliveries_24h Notifications in the last 24 hours, by channel and status.',
      '# TYPE school_erp_deliveries_24h gauge',
      ...deliveries.map((d) =>
        line('school_erp_deliveries_24h', d.n, {
          channel: d.channel,
          status: d.status,
        }),
      ),
    );

    const mem = process.memoryUsage();
    out.push(
      '# TYPE school_erp_process_uptime_seconds gauge',
      line('school_erp_process_uptime_seconds', Math.round(process.uptime())),
      '# TYPE school_erp_process_heap_bytes gauge',
      line('school_erp_process_heap_bytes', mem.heapUsed),
      '# TYPE school_erp_process_rss_bytes gauge',
      line('school_erp_process_rss_bytes', mem.rss),
    );
    return out.join('\n') + '\n';
  }
}
