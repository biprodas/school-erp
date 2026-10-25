import "server-only"

import { serverEnv } from "./env"

/**
 * How this server talks to the backend (server-only). Environment values
 * are getters, read and validated on first use.
 */
export const apiConfig = {
  /** Backend origin without `/api` (`API_URL`). */
  get apiUrl(): string {
    return serverEnv().API_URL
  },
  /**
   * Reverse proxies in front of this server (`TRUSTED_PROXY_HOPS`); see
   * `lib/client-ip.ts` for which forwarded address is trusted.
   */
  get trustedProxyHops(): number {
    return serverEnv().TRUSTED_PROXY_HOPS
  },
  /** Unauthenticated `/public/*` calls from server code. */
  publicTimeoutMs: 5_000,
  /** Host → school lookups in the proxy (`lib/tenant.ts`). */
  tenantLookup: {
    /** How long an answer, "not found" included, is kept. */
    cacheTtlMs: 60_000,
    timeoutMs: 3_000,
  },
  /**
   * BFF request bodies up to this size are buffered, so a 401 can be
   * retried after a refresh; larger ones stream.
   */
  bffMaxBufferedBody: 1_000_000,
} as const
