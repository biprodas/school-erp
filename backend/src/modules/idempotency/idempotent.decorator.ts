import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';
import { IdempotencyInterceptor } from './idempotency.interceptor';

/**
 * Makes a write endpoint safe to retry: clients send a unique
 * `Idempotency-Key` header (e.g. a UUID per user action) and a retry returns
 * the first response instead of repeating the write. Use on endpoints a
 * client may resend: payments, attendance submit, imports, bulk actions.
 */
export const Idempotent = () =>
  applyDecorators(
    UseInterceptors(IdempotencyInterceptor),
    ApiHeader({
      name: 'Idempotency-Key',
      required: false,
      description: 'Unique per user action; retries return the first response',
    }),
  );
