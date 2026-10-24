import { Injectable } from '@nestjs/common';
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

  async record(
    type: DomainEventType,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.eventRepo.saveNew({ type, payload, processedAt: null });
  }
}
