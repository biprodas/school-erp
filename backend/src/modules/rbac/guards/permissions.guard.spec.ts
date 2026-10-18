import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { PermissionResolverService } from '../services/permission-resolver.service';
import { PERMISSIONS } from '../permissions.catalog';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let resolver: { getEffectivePermissions: jest.Mock };

  const makeContext = (user: unknown): ExecutionContext =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    resolver = { getEffectivePermissions: jest.fn() };
    guard = new PermissionsGuard(
      reflector as unknown as Reflector,
      resolver as unknown as PermissionResolverService,
    );
  });

  it('allows handlers with no @RequirePermissions metadata', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(guard.canActivate(makeContext(undefined))).resolves.toBe(true);
    expect(resolver.getEffectivePermissions).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when there is no authenticated user', async () => {
    reflector.getAllAndOverride.mockReturnValue([PERMISSIONS.CLASSES_READ]);

    await expect(guard.canActivate(makeContext(undefined))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('allows access when the user holds the required permission', async () => {
    reflector.getAllAndOverride.mockReturnValue([PERMISSIONS.CLASSES_CREATE]);
    resolver.getEffectivePermissions.mockResolvedValue(
      new Set([PERMISSIONS.CLASSES_READ, PERMISSIONS.CLASSES_CREATE]),
    );

    await expect(
      guard.canActivate(makeContext({ userId: 'u1' })),
    ).resolves.toBe(true);
  });

  it('throws ForbiddenException when the user lacks every required permission', async () => {
    reflector.getAllAndOverride.mockReturnValue([PERMISSIONS.CLASSES_DELETE]);
    resolver.getEffectivePermissions.mockResolvedValue(
      new Set([PERMISSIONS.CLASSES_READ]),
    );

    await expect(
      guard.canActivate(makeContext({ userId: 'u1' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows access when the user holds ANY of several required permissions', async () => {
    reflector.getAllAndOverride.mockReturnValue([
      PERMISSIONS.ROLES_MANAGE,
      PERMISSIONS.ROLES_READ,
    ]);
    resolver.getEffectivePermissions.mockResolvedValue(
      new Set([PERMISSIONS.ROLES_READ]),
    );

    await expect(
      guard.canActivate(makeContext({ userId: 'u1' })),
    ).resolves.toBe(true);
  });
});
