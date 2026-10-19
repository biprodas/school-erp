import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { IdempotencyKey } from './entities/idempotency-key.entity';

/**
 * Deletes expired idempotency keys for every school. Platform-level, so it
 * uses the root connection (no tenant context, RLS bypassed).
 */
@Injectable()
export class IdempotencyCleanupScheduler {
  private readonly logger = new Logger(IdempotencyCleanupScheduler.name);

  constructor(
    @InjectRepository(IdempotencyKey)
    private readonly repo: Repository<IdempotencyKey>,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'idempotency-key-cleanup' })
  async handleCron(): Promise<void> {
    try {
      await this.runOnce(new Date());
    } catch (err) {
      this.logger.error(`Idempotency key cleanup failed: ${String(err)}`);
    }
  }

  async runOnce(now: Date): Promise<number> {
    const result = await this.repo.delete({ expiresAt: LessThan(now) });
    return result.affected ?? 0;
  }
}
