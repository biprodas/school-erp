import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

/**
 * Allows the request only for platform admins (`user.isAdmin === true`).
 * Use after `PlatformJwtAuthGuard`. Returning `false` yields a 403.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    return request.user?.isAdmin === true;
  }
}
