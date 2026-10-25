import "server-only"

import { BRAND } from "./brand-config"
import { securityConfig } from "./security-config"
import { serverEnv } from "./env"

/**
 * Sessions and sign-in (server-only). The session secret is a getter,
 * read and validated on first use.
 */
export const authConfig = {
  /** Key material for sealing the session cookie (`SESSION_SECRET`). */
  get sessionSecret(): string {
    return serverEnv().SESSION_SECRET
  },
  /**
   * One cookie per realm, named after the brand: `school_erp_session` on
   * school hosts, `school_erp_admin` on the admin host.
   */
  cookies: {
    tenant: `${BRAND.cookiePrefix}_session`,
    platform: `${BRAND.cookiePrefix}_admin`,
  },
  /** `Secure` cookies wherever the app is served over HTTPS only. */
  secureCookies: securityConfig.httpsOnly,
  /** Refresh the access token this long before it expires. */
  refreshMarginSeconds: 60,
  /**
   * How long a rotated refresh token still maps to its replacement, so a
   * request that left with the old cookie doesn't trip reuse detection.
   */
  refreshGraceMs: 30_000,
  /** How long "is Google sign-in on?" is kept (`lib/google.ts`). */
  googleProbe: { ttlMs: 5 * 60_000, retryMs: 30_000 },
} as const
