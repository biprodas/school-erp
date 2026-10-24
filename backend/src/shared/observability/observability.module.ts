import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';

/** `/api/metrics` (error tracking is set up in `main.ts`). */
@Module({ controllers: [MetricsController] })
export class ObservabilityModule {}
