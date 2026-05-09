import { SetMetadata } from '@nestjs/common';
import { PlatformRole } from '../../modules/platform/users/enums/platform-role.enum';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: PlatformRole[]) => SetMetadata(ROLES_KEY, roles);
