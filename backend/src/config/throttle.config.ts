import { registerAs } from '@nestjs/config';

/**
 * Global request rate-limiting (`@nestjs/throttler`).
 *
 * `ttl` is the sliding window in **milliseconds**; `limit` is the number of
 * requests allowed per tracked client (tenant + user, or tenant + IP) within
 * that window. Stricter per-route limits (e.g. login) are applied with the
 * `@Throttle` decorator — see `throttle.constants.ts`.
 */
const throttleConfig = registerAs('throttle', () => ({
  enabled: (process.env.RATE_LIMIT_ENABLED ?? 'true') !== 'false',
  ttl: parseInt(process.env.RATE_LIMIT_TTL ?? '60000', 10),
  limit: parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10),
}));

export type ThrottleConfig = ReturnType<typeof throttleConfig>;
export default throttleConfig;
