import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { QueueConfig } from '~/config';
import { CacheStore, MemoryCacheStore, RedisCacheStore } from './cache.store';

/** `CacheStore`: Redis next to BullMQ, in memory with the inline queue. */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: CacheStore,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const cfg = config.get<QueueConfig>('queue')!;
        return cfg.driver === 'inline'
          ? new MemoryCacheStore()
          : new RedisCacheStore(cfg.redisUrl);
      },
    },
  ],
  exports: [CacheStore],
})
export class CacheModule {}
