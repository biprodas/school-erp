import type { AppConfig } from './app.config';
import type { DbConfig } from './db.config';
import type { JwtConfig } from './jwt.config';
import type { MailerConfig } from './mailer.config';
import type { SwaggerConfig } from './swagger.config';
import type { HealthConfig } from './health.config';
import type { ThrottleConfig } from './throttle.config';
import type { DomainsConfig } from './domains.config';
import type { QueueConfig } from './queue.config';
import type { StorageConfig } from './storage.config';
import type { PdfConfig } from './pdf.config';
import type { GoogleConfig } from './google.config';

/** Combined shape of all registered namespaces (matches `configLoaders`). */
export interface RootConfig {
  app: AppConfig;
  db: DbConfig;
  jwt: JwtConfig;
  mailer: MailerConfig;
  swagger: SwaggerConfig;
  health: HealthConfig;
  throttle: ThrottleConfig;
  domains: DomainsConfig;
  queue: QueueConfig;
  storage: StorageConfig;
  pdf: PdfConfig;
  google: GoogleConfig;
}

export type {
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
};
