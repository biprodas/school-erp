import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** Where a sign-in comes from, stored on the session for the device list. */
export interface ClientInfo {
  ip: string | null;
  userAgent: string | null;
}

/**
 * The client address and user agent. `req.ip` follows X-Forwarded-For only
 * through trusted proxies (`TRUST_PROXY`), so a client can't choose it.
 * Both are cut to their column lengths.
 */
export function clientInfoOf(req: Request): ClientInfo {
  return {
    ip: req.ip?.slice(0, 64) || null,
    userAgent: req.header('user-agent')?.slice(0, 512) ?? null,
  };
}

export const Client = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ClientInfo =>
    clientInfoOf(ctx.switchToHttp().getRequest<Request>()),
);
