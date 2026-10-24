import { Injectable } from '@nestjs/common';
import { In, IsNull } from 'typeorm';
import type { DomainEvent } from './entities/domain-event.entity';
import type { DomainEventType } from './domain-events';
import { DomainEventRepository } from './domain-event.repository';

/**
 * Records domain events through the request's tenant connection, so an
 * event commits or rolls back with the change it describes. Call it inside
 * the change's `ds.runInTransaction`.
 */
@Injectable()
export class DomainEventService {
  constructor(private readonly eventRepo: DomainEventRepository) {}

  /** Unprocessed events of some types, oldest first. */
  pending(types: DomainEventType[], limit = 200): Promise<DomainEvent[]> {
    return this.eventRepo.find({
      where: { type: In(types), processedAt: IsNull() },
      order: { occurredAt: 'ASC' },
      take: limit,
    });
  }

  async markProcessed(id: string): Promise<void> {
    await this.eventRepo.markProcessed(id);
  }

  async record(
    type: DomainEventType,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.eventRepo.saveNew({ type, payload, processedAt: null });
  }
}
