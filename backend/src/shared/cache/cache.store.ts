import { Logger, OnApplicationShutdown } from '@nestjs/common';
import IORedis from 'ioredis';

/**
 * A small key/value cache with TTLs (dashboards, PRD 6.22). Redis when the
 * app runs on BullMQ (so every instance shares it), in memory under tests.
 * A cache failure is a miss, never an error.
 */
export abstract class CacheStore {
  abstract get<T>(key: string): Promise<T | undefined>;
  abstract set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  abstract del(key: string): Promise<void>;

  /** The cached value, or `load()` stored for `ttlSeconds`. */
  async wrap<T>(
    key: string,
    ttlSeconds: number,
    load: () => Promise<T>,
  ): Promise<T> {
    const hit = await this.get<T>(key);
    if (hit !== undefined) return hit;
    const value = await load();
    await this.set(key, value, ttlSeconds);
    return value;
  }
}

export class MemoryCacheStore extends CacheStore {
  private readonly entries = new Map<
    string,
    { value: unknown; expires: number }
  >();

  get<T>(key: string): Promise<T | undefined> {
    const entry = this.entries.get(key);
    if (!entry || entry.expires < Date.now()) {
      this.entries.delete(key);
      return Promise.resolve(undefined);
    }
    return Promise.resolve(entry.value as T);
  }

  set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    this.entries.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
    return Promise.resolve();
  }

  del(key: string): Promise<void> {
    this.entries.delete(key);
    return Promise.resolve();
  }
}

export class RedisCacheStore
  extends CacheStore
  implements OnApplicationShutdown
{
  private readonly logger = new Logger(RedisCacheStore.name);
  private readonly redis: IORedis;

  constructor(url: string) {
    super();
    this.redis = new IORedis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    this.redis.on('error', (err) => this.logger.warn(`Cache: ${err.message}`));
    this.redis.connect().catch(() => undefined);
  }

  async get<T>(key: string): Promise<T | undefined> {
    try {
      const raw = await this.redis.get(`cache:${key}`);
      return raw === null ? undefined : (JSON.parse(raw) as T);
    } catch {
      return undefined;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(
        `cache:${key}`,
        JSON.stringify(value),
        'EX',
        ttlSeconds,
      );
    } catch {
      // A failed write is a later miss.
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(`cache:${key}`);
    } catch {
      // Expires on its own.
    }
  }

  onApplicationShutdown(): void {
    this.redis.disconnect();
  }
}
