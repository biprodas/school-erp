import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Key } from '~/common/enums/keys.enum';
import { PermissionResolverService } from './permission-resolver.service';
import { PermissionKey } from './permissions.catalog';

/**
 * Enforces `@RequirePermissions(...)` metadata. Must run AFTER `JwtAuthGuard`
 * (which populates `request.user`). A handler with no metadata is allowed.
 * A user passes if they hold at least one of the required permissions.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly resolver: PermissionResolverService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PermissionKey[]>(
      Key.Permissions,
      [context.getHandler(), context.getClass()],
    );

    if (!required?.length) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: { userId?: string } }>();
    const userId = request.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    const effective = await this.resolver.getEffectivePermissions(userId);
    const allowed = required.some((permission) => effective.has(permission));
    if (!allowed) {
      throw new ForbiddenException(
        `Missing required permission: ${required.join(' or ')}`,
      );
    }

    return true;
  }
}
