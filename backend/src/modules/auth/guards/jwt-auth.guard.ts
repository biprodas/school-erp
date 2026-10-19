import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { assertPasswordChangeAllowed } from '~/common/auth/password-change';

/** Tenant realm: a valid token of this school with an active session. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
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
