import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { Key } from '../enums/keys.enum';

/** Where a sign-in comes from, stored on the session for the device list. */
export interface ClientInfo {
  ip: string | null;
  userAgent: string | null;
}

export const Client = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ClientInfo => {
    const req = ctx.switchToHttp().getRequest<Request>();
    const forwarded = req.header(Key.ForwardedForTokenHeader);
    return {
      ip: forwarded?.split(',')[0]?.trim() || req.ip || null,
      userAgent: req.header('user-agent') ?? null,
    };
  },
);
