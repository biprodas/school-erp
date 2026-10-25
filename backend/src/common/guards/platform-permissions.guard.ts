import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import {
  type PlatformPermission,
  platformCan,
} from '~/common/auth/platform-permissions';
import { Key } from '~/common/enums/keys.enum';

/**
 * Enforces `@RequirePlatformPermissions(...)` against the caller's platform
 * role (`req.user.platformRole`, from the platform token). Runs after
 * `PlatformJwtAuthGuard`. A handler without the metadata is open to any
 * platform user, so only self-service routes go without it.
 */
@Injectable()
export class PlatformPermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PlatformPermission[]>(
      Key.PlatformPermissions,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const role = context.switchToHttp().getRequest<Request>()
      .user?.platformRole;
    if (required.some((permission) => platformCan(role, permission))) {
      return true;
    }
    throw new ForbiddenException({
      message: 'Your platform role does not allow this.',
      code: 'PLATFORM_PERMISSION_REQUIRED',
    });
  }
}
