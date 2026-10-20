/**
 * Express's `trust proxy` setting from `TRUST_PROXY`: which hops in front of
 * the API may set `X-Forwarded-For`, so `req.ip` is the real client and a
 * client can't pick its own address (audit log, sessions, rate limits).
 * A number trusts that many hops; `true`/`false` all or none; anything else
 * is Express's list form (`loopback, 10.0.0.0/8`). The default trusts
 * proxies on loopback and private networks (a reverse proxy or load
 * balancer in the same network); set `false` when clients reach the API
 * directly.
 */
export function parseTrustProxy(
  value: string | undefined,
): boolean | number | string {
  const raw = value?.trim();
  if (!raw) return 'loopback, linklocal, uniquelocal';
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/^\d+$/.test(raw)) return Number(raw);
  return raw;
}
