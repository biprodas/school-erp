import { Module } from '@nestjs/common';
import { DomainEventRepository } from './domain-event.repository';
import { DomainEventService } from './domain-event.service';

/** The domain event outbox (`domain_events`). */
@Module({
  providers: [DomainEventRepository, DomainEventService],
  exports: [DomainEventService],
})
export class DomainEventModule {}
