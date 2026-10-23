import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import {
  PlanModuleGuard,
  REQUIRE_MODULE_KEY,
} from '../guards/plan-module.guard';
import type { PlanModule } from '../plans.catalog';

/**
 * The school's plan must include `module`, else 403 `MODULE_NOT_IN_PLAN`.
 * Put it on handlers (its guard runs after the class's `JwtAuthGuard` and
 * `PermissionsGuard`, so unauthenticated callers still get a 401).
 */
export const RequireModule = (module: PlanModule) =>
  applyDecorators(
    SetMetadata(REQUIRE_MODULE_KEY, module),
    UseGuards(PlanModuleGuard),
  );
