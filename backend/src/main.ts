import { Logger } from '@nestjs/common';
import {
  flushErrorTracking,
  initErrorTracking,
} from './shared/observability/error-tracking';
import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { ConfigService } from '@nestjs/config';
import { AppConfig, setupSwagger } from '~/config';
import { parseCorsOrigins } from './config/cors';

async function bootstrap() {
  // Before anything else, so start-up errors are caught too.
  const tracking = initErrorTracking();

  // Buffer start-up logs until pino is ready, then route Nest's logger to it.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));

  configureApp(app);

  app.enableCors({
    origin: parseCorsOrigins(process.env.CORS_ORIGIN),
    credentials: true,
  });

  const configService = app.get(ConfigService);
  const appConfig = configService.get<AppConfig>('app');
  if (!appConfig) {
    throw new Error('App config not found');
  }

  const swaggerCfg = setupSwagger(app);

  app.enableShutdownHooks();
  process.once('beforeExit', () => void flushErrorTracking());

  await app.listen(appConfig.port);

  const logger = new Logger('Bootstrap');
  const baseUrl = `http://${appConfig.host}:${appConfig.port}`;
  logger.log(`API running on ${baseUrl}`);
  if (tracking) logger.log('Error tracking is on (Sentry)');
  if (swaggerCfg) {
    logger.log(`Swagger docs available at ${baseUrl}/${swaggerCfg.path}`);
  }
}

void bootstrap();
