import { Module, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import type { Request } from 'express';
import { LoggerModule } from 'nestjs-pino';
import { Key } from '~/common/enums/keys.enum';
import type { RequestWithOrg } from '~/tenancy/tenant.middleware';
import { LogContextInterceptor } from './log-context.interceptor';

/**
 * Structured JSON logs (pino) for the whole app. `main.ts` hands Nest's
 * logger over to pino, so `new Logger(Context)` in any class logs through it.
 *
 * - Every log line written during a request carries its `reqId` (the
 *   `x-request-id` header); lines from handlers also carry `orgId`/`userId`
 *   (LogContextInterceptor).
 * - One line per completed request, with status, timing, `orgId` and
 *   `userId`, including requests a guard rejected.
 * - Pretty-printed in development, JSON elsewhere; `LOG_LEVEL` sets the level.
 */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const nodeEnv = config.get<string>('NODE_ENV') ?? 'development';
        const isProduction = nodeEnv === 'production';
        return {
          pinoHttp: {
            level:
              config.get<string>('LOG_LEVEL') ??
              (isProduction ? 'info' : 'debug'),
            // Pretty output for local development only; JSON everywhere else.
            ...(nodeEnv !== 'development'
              ? {}
              : {
                  transport: {
                    target: 'pino-pretty',
                    options: { singleLine: true },
                  },
                }),
            // RequestIdMiddleware (app.setup.ts) has set the header by now.
            genReqId: (req: Request) =>
              req.headers[Key.RequestIdTokenHeader] as string,
            customProps: (req: Request) => ({
              orgId: (req as RequestWithOrg).orgId,
              userId: req.user?.userId,
            }),
            redact: ['req.headers.authorization', 'req.headers.cookie'],
            autoLogging: {
              ignore: (req: Request) =>
                req.originalUrl.startsWith('/api/health'),
            },
          },
          // In-request lines carry just `reqId`, not the whole request.
          quietReqLogger: true,
          // Nest 11 route syntax (the default `*` triggers a legacy warning).
          forRoutes: [{ path: '{*splat}', method: RequestMethod.ALL }],
        };
      },
    }),
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: LogContextInterceptor }],
})
export class LoggingModule {}
