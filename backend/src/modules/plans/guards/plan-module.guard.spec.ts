import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PLAN_MODULES } from '../plans.catalog';
import type { EntitlementService } from '../services/entitlement.service';
import { PlanModuleGuard } from './plan-module.guard';

describe('PlanModuleGuard', () => {
  const context = (orgId?: string) =>
    ({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ orgId }) }),
    }) as unknown as ExecutionContext;

  const guard = (module: string | undefined, has: boolean) =>
    new PlanModuleGuard(
      { getAllAndOverride: () => module } as unknown as Reflector,
      {
        assertModule: (_: string, m: string) =>
          has
            ? Promise.resolve()
            : Promise.reject(
                new ForbiddenException({ code: 'MODULE_NOT_IN_PLAN', m }),
              ),
      } as unknown as EntitlementService,
    );

  it('passes routes without @RequireModule', async () => {
    await expect(guard(undefined, false).canActivate(context())).resolves.toBe(
      true,
    );
  });

  it("checks the request's school", async () => {
    await expect(
      guard(PLAN_MODULES.FEES, true).canActivate(context('org-1')),
    ).resolves.toBe(true);
    await expect(
      guard(PLAN_MODULES.FEES, false).canActivate(context('org-1')),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      guard(PLAN_MODULES.FEES, true).canActivate(context()),
    ).rejects.toThrow(ForbiddenException);
  });
});
