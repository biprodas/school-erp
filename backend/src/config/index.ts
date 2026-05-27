import type { ConfigFactory } from '@nestjs/config';
import appConfig from './app.config';
import dbConfig from './db.config';
import jwtConfig from './jwt.config';
import swaggerConfig from './swagger.config';
import healthConfig from './health.config';

/**
 * Single place to register config namespaces. Add new `*.config.ts` files and append here.
 */
export const configLoaders: ConfigFactory[] = [
  appConfig,
  dbConfig,
  jwtConfig,
  swaggerConfig,
  healthConfig,
];

export type {
  RootConfig,
  AppConfig,
  DbConfig,
  JwtConfig,
  SwaggerConfig,
  HealthConfig,
} from './config.types';
export { validateEnv, envValidationSchema } from './env.validation';
export { setupSwagger } from './swagger.setup';
