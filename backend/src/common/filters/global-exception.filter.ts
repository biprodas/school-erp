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
const PG_CONFLICTS: Record<string, string> = {
  '23505': 'A record with the same unique value already exists',
  '23503': 'The record is referenced by, or references, a missing record',
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
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
      ...(requestId && { requestId }),
    });
  }
}
