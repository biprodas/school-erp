import { ForbiddenException, Injectable } from '@nestjs/common';
import { CanActivate, ExecutionContext } from '@nestjs/common';
import { PlatformRole } from '~/platform/users/enums/platform-role.enum';

@Injectable()
export class SelfOrAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const targetId = request.params.id; // or from body

    const isSelf = user?.id === targetId;
    const isSuperAdmin = user?.role === PlatformRole.SUPER_ADMIN;

    if (!isSelf && !isSuperAdmin) {
      throw new ForbiddenException('You can only update your own profile');
    }

    return true;
  }
}
