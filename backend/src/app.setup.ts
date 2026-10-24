import {
  ClassSerializerInterceptor,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { parseTrustProxy } from './config/trust-proxy';
import { GlobalExceptionFilter } from '~/common/filters/global-exception.filter';
import { RequestIdMiddleware } from '~/common/middlewares/request-id.middleware';
import { ResponseEnvelopeInterceptor } from '~/common/interceptors/response-envelope.interceptor';

/**
 * Request pipeline shared by `main.ts` and the e2e tests, so tests exercise
 * the same prefix, validation, serialization and error handling as the
 * running server, secure headers included. Server-only concerns (CORS,
 * Swagger, listen) stay in `main.ts`.
 */
export function configureApp(app: INestApplication): void {
  // `req.ip` honours X-Forwarded-For only from trusted proxies.
  (app as NestExpressApplication).set(
    'trust proxy',
    parseTrustProxy(process.env.TRUST_PROXY),
  );

  // Before every other middleware, so logs and errors can use the id.
  app.use(RequestIdMiddleware);

  // Secure headers (PRD 8.1): HSTS, nosniff, frame denial, a strict CSP for
  // the JSON API, no X-Powered-By. API answers carry personal data, so no
  // browser or proxy may cache them.
  app.use(helmet());
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

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
