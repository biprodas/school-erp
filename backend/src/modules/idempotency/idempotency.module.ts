import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdempotencyKey } from './entities/idempotency-key.entity';
import { IdempotencyCleanupScheduler } from './idempotency-cleanup.scheduler';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IdempotencyStore } from './idempotency.store';

/** `@Idempotent()` support; global so any controller can use the decorator. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([IdempotencyKey])],
  providers: [
    IdempotencyStore,
    IdempotencyInterceptor,
    IdempotencyCleanupScheduler,
  ],
  exports: [IdempotencyStore, IdempotencyInterceptor],
})
export class IdempotencyModule {}
