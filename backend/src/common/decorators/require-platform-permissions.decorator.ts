import { SetMetadata } from '@nestjs/common';
import type { PlatformPermission } from '~/common/auth/platform-permissions';
import { Key } from '~/common/enums/keys.enum';

/**
 * The platform permissions a handler (or controller) needs; the caller
 * passes `PlatformPermissionsGuard` with AT LEAST ONE of them. Use with
 * `@UseGuards(PlatformJwtAuthGuard, PlatformPermissionsGuard)`.
 */
export const RequirePlatformPermissions = (
  ...permissions: PlatformPermission[]
) => SetMetadata(Key.PlatformPermissions, permissions);
