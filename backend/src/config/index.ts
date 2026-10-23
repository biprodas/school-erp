import type { ConfigFactory } from '@nestjs/config';
import appConfig from './app.config';
import dbConfig from './db.config';
import jwtConfig from './jwt.config';
import mailerConfig from './mailer.config';
import swaggerConfig from './swagger.config';
import healthConfig from './health.config';
import throttleConfig from './throttle.config';
import domainsConfig from './domains.config';
import queueConfig from './queue.config';
import storageConfig from './storage.config';
import pdfConfig from './pdf.config';
import googleConfig from './google.config';

/**
 * Single place to register config namespaces. Add new `*.config.ts` files and append here.
 */
export const configLoaders: ConfigFactory[] = [
  appConfig,
  dbConfig,
  jwtConfig,
  mailerConfig,
  swaggerConfig,
  healthConfig,
  throttleConfig,
  domainsConfig,
  queueConfig,
  storageConfig,
  pdfConfig,
  googleConfig,
];

export type {
  RootConfig,
  AppConfig,
  DbConfig,
  JwtConfig,
  MailerConfig,
  SwaggerConfig,
  HealthConfig,
  ThrottleConfig,
  DomainsConfig,
  QueueConfig,
  StorageConfig,
  PdfConfig,
  GoogleConfig,
} from './config.types';
export { validateEnv, envValidationSchema } from './env.validation';
export { setupSwagger } from './swagger.setup';
