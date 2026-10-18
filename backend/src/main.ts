import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { ConfigService } from '@nestjs/config';
import { AppConfig, setupSwagger } from '~/config';
import { parseCorsOrigins } from './config/cors';

async function bootstrap() {
  // Buffer start-up logs until pino is ready, then route Nest's logger to it.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));

  configureApp(app);

  app.use(helmet());

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

  await app.listen(appConfig.port);

  const logger = new Logger('Bootstrap');
  const baseUrl = `http://${appConfig.host}:${appConfig.port}`;
  logger.log(`API running on ${baseUrl}`);
  if (swaggerCfg) {
    logger.log(`Swagger docs available at ${baseUrl}/${swaggerCfg.path}`);
  }
}

void bootstrap();
