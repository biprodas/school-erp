import { reportError } from '~/shared/observability/error-tracking';
import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { Key } from '../enums/keys.enum';

/**
 * Postgres constraint violations that are the client's conflict, not a
 * server error: they usually mean a concurrent request won a race that the
 * service-level check couldn't see (e.g. two "set current year" calls).
 */
const PG_CONFLICTS: Record<string, { code: string; message: string }> = {
  '23505': {
    code: 'UNIQUE_VIOLATION',
    message: 'A record with the same unique value already exists',
  },
  '23503': {
    code: 'FOREIGN_KEY_VIOLATION',
    message: 'The record is referenced by, or references, a missing record',
  },
};

function toHttpException(exception: unknown): unknown {
  if (exception instanceof QueryFailedError) {
    const code = (exception.driverError as { code?: string } | undefined)?.code;
    if (code && PG_CONFLICTS[code]) {
      return new ConflictException(PG_CONFLICTS[code]);
    }
  }
  return exception;
}

/**
 * Stable machine-readable error code the frontend maps to localized text.
 * Throw `new ConflictException({ message, code: 'SLUG_TAKEN' })` to set one;
 * otherwise it is derived from the status (`NOT_FOUND`, `FORBIDDEN`, …), and
 * ValidationPipe failures (a message array) become `VALIDATION_FAILED`.
 */
export function errorCode(
  status: number,
  body: Record<string, unknown>,
): string {
  if (typeof body.code === 'string' && body.code) return body.code;
  if (status === 400 && Array.isArray(body.message)) {
    return 'VALIDATION_FAILED';
  }
  if (status >= 500) return 'INTERNAL_ERROR';
  return (HttpStatus as Record<number, string>)[status] ?? 'ERROR';
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(error: unknown, host: ArgumentsHost) {
    const exception = toHttpException(error);
    if (exception !== error) {
      this.logger.warn(`Database conflict: ${(error as Error).message}`);
    }
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const baseBody =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' };

    const body: Record<string, unknown> =
      typeof baseBody === 'string'
        ? { message: baseBody }
        : (baseBody as Record<string, unknown>);

    const requestId = req.headers?.[Key.RequestIdTokenHeader] as
      string | undefined;

    if (status >= 500) {
      reportError(exception, {
        orgId: (req as { orgId?: string }).orgId ?? null,
        requestId: requestId ?? null,
        where: `${req.method} ${(req.originalUrl ?? '').split('?')[0]}`,
      });
      this.logger.error(
        `${req.method} ${req.originalUrl} -> ${status}`,
        (exception as Error)?.stack,
      );
    }

    // Envelope fields come last so an exception body can't override them.
    res.status(status).json({
      ...body,
      success: false,
      statusCode: status,
      message: body.message ?? 'Request failed',
      code: errorCode(status, body),
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
      ...(requestId && { requestId }),
    });
  }
}
