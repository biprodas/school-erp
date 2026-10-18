import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { Key } from '../enums/keys.enum';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Makes sure every request has a UUID `x-request-id` (keeping a valid one
 * from the client or a proxy) and echoes it on the response. Logs, error
 * bodies and the request context all use it.
 */
export function RequestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.header(Key.RequestIdTokenHeader);
  const requestId =
    incoming && UUID_PATTERN.test(incoming) ? incoming : randomUUID();
  req.headers[Key.RequestIdTokenHeader] = requestId;
  res.set(Key.RequestIdTokenHeader, requestId);
  next();
}
