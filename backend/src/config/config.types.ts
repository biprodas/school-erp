import type { AppConfig } from './app.config';
import type { DbConfig } from './db.config';
import type { JwtConfig } from './jwt.config';
import type { SwaggerConfig } from './swagger.config';
import type { HealthConfig } from './health.config';

/** Combined shape of all registered namespaces (matches `configLoaders`). */
export interface RootConfig {
  app: AppConfig;
  db: DbConfig;
  jwt: JwtConfig;
  swagger: SwaggerConfig;
  health: HealthConfig;
}

export type {
  AppConfig,
  DbConfig,
  JwtConfig,
  SwaggerConfig,
  HealthConfig,
};
