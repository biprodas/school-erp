import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

/**
 * Allows the request only if the authenticated tenant user has `isAdmin = true`.
 * Pair with `JwtAuthGuard` (which populates `request.user`).
 */
@Injectable()
export class IsAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: { isAdmin?: boolean } }>();

    if (!request.user?.isAdmin) {
      throw new ForbiddenException('Admin only');
    }
    return true;
  }
}
