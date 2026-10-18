import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  RawResponse,
  ResponseMessage,
} from '../decorators/response.decorators';
import { Paginated, PaginationMeta } from '../dto/paginated.dto';

export interface ResponseEnvelope<T> {
  success: true;
  statusCode: number;
  message: string;
  data: T | null;
  meta?: PaginationMeta;
}

/**
 * Wraps every HTTP handler result in the standard envelope, so handlers just
 * return their data. The message comes from `@ResponseMessage()`; a returned
 * `Paginated` puts its items in `data` and its page info in `meta`. Errors
 * get the matching `success: false` shape from `GlobalExceptionFilter`.
 */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const targets = [context.getHandler(), context.getClass()];
    if (
      context.getType() !== 'http' ||
      this.reflector.getAllAndOverride(RawResponse, targets)
    ) {
      return next.handle();
    }

    const message =
      this.reflector.getAllAndOverride(ResponseMessage, targets) ?? 'OK';
    const res = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((result: unknown) => {
        if (result instanceof StreamableFile) return result;
        const envelope: ResponseEnvelope<unknown> = {
          success: true,
          statusCode: res.statusCode,
          message,
          data: result ?? null,
        };
        if (result instanceof Paginated) {
          envelope.data = result.items;
          envelope.meta = result.meta;
        }
        return envelope;
      }),
    );
  }
}
