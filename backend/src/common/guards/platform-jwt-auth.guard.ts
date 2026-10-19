import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { assertPasswordChangeAllowed } from '../auth/password-change';

/** Platform realm: a valid platform token with an active session. */
@Injectable()
export class PlatformJwtAuthGuard extends AuthGuard('platform-jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ok = (await super.canActivate(context)) as boolean;
    const req = context.switchToHttp().getRequest<Request>();
    assertPasswordChangeAllowed(this.reflector, context, req.user);
    return ok;
  }
}
