import {
  ClassSerializerInterceptor,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { parseTrustProxy } from './config/trust-proxy';
import { GlobalExceptionFilter } from '~/common/filters/global-exception.filter';
import { RequestIdMiddleware } from '~/common/middlewares/request-id.middleware';
import { ResponseEnvelopeInterceptor } from '~/common/interceptors/response-envelope.interceptor';

/**
 * Request pipeline shared by `main.ts` and the e2e tests, so tests exercise
 * the same prefix, validation, serialization and error handling as the
 * running server. Server-only concerns (helmet, CORS, Swagger, listen) stay
 * in `main.ts`.
 */
export function configureApp(app: INestApplication): void {
  // `req.ip` honours X-Forwarded-For only from trusted proxies.
  (app as NestExpressApplication).set(
    'trust proxy',
    parseTrustProxy(process.env.TRUST_PROXY),
  );

  // Before every other middleware, so logs and errors can use the id.
  app.use(RequestIdMiddleware);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      skipUndefinedProperties: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  // Listed outermost first: handler results are wrapped in the envelope,
  // then the serializer applies @Exclude/@Expose to the entities inside it.
  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(reflector, {
      enableImplicitConversion: true,
    }),
    new ResponseEnvelopeInterceptor(reflector),
  );
}
