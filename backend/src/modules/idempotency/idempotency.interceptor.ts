import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ContextIdFactory, ModuleRef } from '@nestjs/core';
import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { from, Observable, of, throwError } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';
import { IdempotencyStore } from './idempotency.store';

export const IDEMPOTENCY_HEADER = 'idempotency-key';
const KEY_PATTERN = /^[A-Za-z0-9_\-:.]{8,128}$/;

export function requestHash(req: Request): string {
  return createHash('sha256')
    .update(
      `${req.method} ${req.originalUrl}\n${JSON.stringify(req.body ?? null)}`,
    )
    .digest('hex');
}

/**
 * Applied by `@Idempotent()`. Without the header the request runs normally.
 * With it: the first request claims the key and its response is stored; a
 * retry with the same key and body gets that response again (same status);
 * the same key with a different body is 422; a retry while the first one is
 * still running is 409. A failed request frees the key.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly moduleRef: ModuleRef) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const key = req.headers[IDEMPOTENCY_HEADER];
    if (key === undefined) return next.handle();
    if (typeof key !== 'string' || !KEY_PATTERN.test(key)) {
      return throwError(
        () =>
          new BadRequestException({
            message:
              'Idempotency-Key must be 8–128 characters of [A-Za-z0-9_-:.]',
            code: 'IDEMPOTENCY_KEY_INVALID',
          }),
      );
    }

    return from(
      this.moduleRef.resolve(
        IdempotencyStore,
        ContextIdFactory.getByRequest(req),
        { strict: false },
      ),
    ).pipe(
      mergeMap(async (store) => ({
        store,
        claim: await store.claim(
          key,
          requestHash(req),
          req.user?.userId ?? null,
        ),
      })),
      mergeMap(({ store, claim }) => {
        switch (claim.state) {
          case 'mismatch':
            throw new UnprocessableEntityException({
              message: 'This Idempotency-Key was used for a different request',
              code: 'IDEMPOTENCY_KEY_REUSED',
            });
          case 'in_progress':
            throw new ConflictException({
              message: 'A request with this Idempotency-Key is still running',
              code: 'IDEMPOTENCY_IN_PROGRESS',
            });
          case 'completed':
            res.status(claim.statusCode);
            res.setHeader('Idempotent-Replayed', 'true');
            return of(claim.response);
          case 'claimed':
            return next.handle().pipe(
              mergeMap(async (data: unknown) => {
                await store.complete(claim.id, res.statusCode, data);
                return data;
              }),
              catchError(async (err: unknown) => {
                await store.release(claim.id);
                throw err;
              }),
            );
        }
      }),
    );
  }
}
