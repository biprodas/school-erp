import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DiskHealthIndicator,
  HealthCheckService,
  HttpHealthIndicator,
  MemoryHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { AppConfig, HealthConfig } from '~/config';

@Injectable()
export class HealthService {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly http: HttpHealthIndicator,
    private readonly disk: DiskHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly configService: ConfigService,
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
    ]);
  }
}
