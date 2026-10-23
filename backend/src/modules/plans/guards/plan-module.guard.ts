import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RequestWithOrg } from '~/tenancy/tenant.middleware';
import { EntitlementService } from '../services/entitlement.service';
import type { PlanModule } from '../plans.catalog';

export const REQUIRE_MODULE_KEY = 'plan:requireModule';

/** Enforces `@RequireModule(...)` for the request's school. */
@Injectable()
export class PlanModuleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlements: EntitlementService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const module = this.reflector.getAllAndOverride<PlanModule | undefined>(
      REQUIRE_MODULE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!module) return true;
    const { orgId } = context.switchToHttp().getRequest<RequestWithOrg>();
    if (!orgId) {
      throw new ForbiddenException({
        message: "This feature isn't included in your school's plan",
        code: 'MODULE_NOT_IN_PLAN',
      });
    }
    await this.entitlements.assertModule(orgId, module);
    return true;
  }
}
