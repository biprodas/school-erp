type CorsOrigin = string | RegExp;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Parses `CORS_ORIGIN` (comma-separated). A `*.` label matches any single
 * subdomain, so tenant hosts can be allowed with one entry:
 * `https://*.example.com` allows `https://acme.example.com` but neither
 * `https://example.com` nor `https://a.b.example.com`.
 *
 * Returns `true` (reflect any origin) when the variable is empty; env
 * validation requires it in production.
 */
export function parseCorsOrigins(
  value: string | undefined,
): CorsOrigin[] | true {
  const entries = (value ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (!entries.length) return true;

  return entries.map((entry) => {
    if (!entry.includes('*')) return entry;
    const match = /^(https?:\/\/)\*\.([^*]+)$/.exec(entry);
    if (!match) {
      throw new Error(
        `CORS_ORIGIN entry "${entry}": only a leading "*." subdomain wildcard is supported`,
      );
    }
    const [, scheme, rest] = match;
    return new RegExp(
      `^${escapeRegExp(scheme)}[a-z0-9-]+\\.${escapeRegExp(rest)}$`,
      'i',
    );
  });
}
