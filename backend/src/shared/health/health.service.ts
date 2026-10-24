import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DiskHealthIndicator,
  HealthCheckService,
  HealthIndicatorService,
  HttpHealthIndicator,
  MemoryHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { AppConfig, HealthConfig } from '~/config';
import { JobQueue } from '~/shared/queue';
import { StorageService } from '~/shared/storage/storage.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly http: HttpHealthIndicator,
    private readonly disk: DiskHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly configService: ConfigService,
    private readonly indicator: HealthIndicatorService,
    private readonly queue: JobQueue,
    private readonly storage: StorageService,
  ) {}

  check() {
    const app = this.configService.get<AppConfig>('app')!;
    const h = this.configService.get<HealthConfig>('health')!;
    const selfUrl = `http://${app.host}:${app.port}/api`;

    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.http.pingCheck('http-self', selfUrl),
      () =>
        this.disk.checkStorage('disk', {
          path: h.diskPath,
          thresholdPercent: h.diskThreshold,
        }),
      () => this.memory.checkHeap('memory-heap', h.memoryHeapBytes),
      () => this.memory.checkRSS('memory-rss', h.memoryRssBytes),
      // Redis backs the job queues; the inline (test) queue always passes.
      () => this.reach('redis', () => this.queue.ping()),
      () => this.reach('storage', () => this.storage.ping()),
    ]);
  }

  /** Up when `ping` resolves, down with its error otherwise. */
  private async reach(key: string, ping: () => Promise<void>) {
    const check = this.indicator.check(key);
    try {
      await ping();
      return check.up();
    } catch (err) {
      return check.down({ message: (err as Error).message ?? String(err) });
    }
  }
}
