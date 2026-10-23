import type { EntitlementService } from './services/entitlement.service';

/**
 * An `EntitlementService` for unit tests that allows every module and
 * limit. Override a method to test a refusal.
 */
export function allowAllEntitlements(): EntitlementService {
  return {
    assertLimit: () => Promise.resolve(),
    assertModule: () => Promise.resolve(),
    hasModule: () => Promise.resolve(true),
    invalidate: () => undefined,
  } as unknown as EntitlementService;
}
