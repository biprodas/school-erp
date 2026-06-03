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
    const isAdmin = user?.role === PlatformRole.ADMIN;

    if (!isSelf && !isAdmin) {
      throw new ForbiddenException('You can only update your own profile');
    }

    return true;
  }
}
