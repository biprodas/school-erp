import { seconds } from '@nestjs/throttler';

/**
 * Stricter limit for credential-bearing endpoints (login / register /
 * activation) to blunt brute-force and enumeration. Applied per route via
 * `@Throttle(AUTH_THROTTLE)`; overrides the global throttler for that handler.
 *
 * Tuned conservatively (5 requests / minute per tracked client). Override the
 * limit on individual routes by passing different values to `@Throttle`.
 */
export const AUTH_THROTTLE = {
  default: { limit: 5, ttl: seconds(60) },
};
