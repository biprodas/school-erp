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

/**
 * Public lookups that must not become an enumeration tool (slug checks,
 * "Find your school", signup): 10 requests / minute per client.
 */
export const PUBLIC_LOOKUP_THROTTLE = {
  default: { limit: 10, ttl: seconds(60) },
};

/**
 * File uploads (photos, documents, imports, attachments): 20 a minute per
 * client, so bulk uploads can't fill storage or tie up the server.
 */
export const UPLOAD_THROTTLE = {
  default: { limit: 20, ttl: seconds(60) },
};
