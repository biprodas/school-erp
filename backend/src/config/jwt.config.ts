import { registerAs } from '@nestjs/config';

const UNIT_MS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

/** `30d`, `12h`, `15m`, `90s` → milliseconds. */
export function durationMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) throw new Error(`Invalid duration "${value}"`);
  return Number(match[1]) * UNIT_MS[match[2] as keyof typeof UNIT_MS];
}

const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET,
  /**
   * Access-token lifetime. Target is `15m` once the frontend refreshes
   * tokens; until then it stays long (see doc/backend-plan.md M0 4.3).
   */
  expiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  /** Refresh-token lifetime; each refresh starts a new window. */
  refreshTtlMs: durationMs(process.env.JWT_REFRESH_TTL ?? '30d'),
}));

export type JwtConfig = ReturnType<typeof jwtConfig>;
export default jwtConfig;
