import type { ConfigFactory } from '@nestjs/config';
import appConfig from './app.config';
import dbConfig from './db.config';
import jwtConfig from './jwt.config';
import swaggerConfig from './swagger.config';

/**
 * Single place to register config namespaces. Add new `*.config.ts` files and append here.
 */
export const configLoaders: ConfigFactory[] = [
  appConfig,
  dbConfig,
  jwtConfig,
  swaggerConfig,
];

export type {
  RootConfig,
  AppConfig,
  DbConfig,
  JwtConfig,
  SwaggerConfig,
} from './config.types';
export { validateEnv, envValidationSchema } from './env.validation';
