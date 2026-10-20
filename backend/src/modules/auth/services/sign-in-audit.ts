import { HttpException } from '@nestjs/common';

/** A short reason for a refused sign-in, from the exception's `code`. */
export function signInRefusalReason(err: unknown): string {
  if (err instanceof HttpException) {
    const body = err.getResponse();
    if (typeof body === 'object' && body && 'code' in body) {
      return String(body.code).toLowerCase();
    }
    return `http_${err.getStatus()}`;
  }
  return 'error';
}
