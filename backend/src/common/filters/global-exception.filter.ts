import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { Key } from '~/common/enums/keys.enum';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const baseBody =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' };

    const body =
      typeof baseBody === 'string' ? { message: baseBody } : (baseBody as any);

    const requestId = req.headers?.[Key.RequestIdTokenHeader] as string | undefined;

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} -> ${status}`,
        (exception as Error)?.stack,
      );
    }

    res.status(status).json({
      statusCode: status,
      path: req.url,
      timestamp: new Date().toISOString(),
      ...(requestId && { requestId }),
      ...body,
    });
  }
}
