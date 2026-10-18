import { SetMetadata } from '@nestjs/common';
import { Key } from '~/common/enums/keys.enum';
import { PermissionKey } from '../permissions.catalog';

/**
 * Marks a route handler (or controller) with the permissions required to
 * access it. A user passes the `PermissionsGuard` if they hold AT LEAST ONE
 * of the listed permissions.
 *
 * Usage: `@RequirePermissions(PERMISSIONS.CATS_CREATE)`
 */
export const RequirePermissions = (...permissions: PermissionKey[]) =>
  SetMetadata(Key.Permissions, permissions);
