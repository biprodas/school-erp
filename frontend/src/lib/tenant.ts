/**
 * Host → tenant slug resolution.
 *
 * Two tiers:
 *  1. **Subdomain of our platform domain** (`acme.lvh.me`, `acme.mydomain.com`)
 *     — the slug is in the host; strip the configured root domain.
 *  2. **Custom / vanity domain** (`app.acmeschool.com`) — not parseable; the
 *     host is an opaque key resolved via the backend's public lookup endpoint.
 */

import { API_BASE_URL } from "~/config";

/** Platform root domain, e.g. `lvh.me` in dev or `mydomain.com` in prod. */
const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "")
  .toLowerCase()
  .replace(/^\./, "");

const RESERVED_LABELS = new Set([
  "www",
  "api",
  "app",
  "platform",
  "admin",
  "dashboard",
]);

const SLUG_PATTERN = /^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$/;

function hostname(host: string): string {
  return host.split(":")[0].toLowerCase();
}

/**
 * Tier 1 — parse the tenant slug from a host that is a subdomain of the
 * configured root domain. Returns `null` for the apex, reserved subdomains,
 * custom domains, or when no root domain is configured.
 */
export function getTenantSlugFromHost(host?: string | null): string | null {
  if (!host) return null;
  const h = hostname(host);

  if (ROOT_DOMAIN) {
    if (h === ROOT_DOMAIN || h === `www.${ROOT_DOMAIN}`) return null;
    if (!h.endsWith(`.${ROOT_DOMAIN}`)) return null; // custom / unrelated host
    const subPortion = h.slice(0, h.length - ROOT_DOMAIN.length - 1);
    const slug = subPortion.split(".").pop() ?? ""; // label adjacent to root
    if (!slug || RESERVED_LABELS.has(slug) || !SLUG_PATTERN.test(slug)) {
      return null;
    }
    return slug;
  }

  // Fallback when no root domain configured: first label of a multi-label host.
  const labels = h.split(".");
  if (labels.length < 2) return null;
  const slug = labels[0];
  if (
    !slug ||
    RESERVED_LABELS.has(slug) ||
    ["localhost", "lvh"].includes(slug) ||
    /^[0-9]+$/.test(slug) ||
    !SLUG_PATTERN.test(slug)
  ) {
    return null;
  }
  return slug;
}

/**
 * True if the host is the platform apex/root (where the Platform auth UI shows).
 * `localhost`/IP (dev apex), the root domain, and `www.<root>` are platform;
 * any subdomain or custom domain is a tenant host.
 */
export function isPlatformHost(host?: string | null): boolean {
  if (!host) return false;
  const h = hostname(host);
  if (h === "localhost" || /^[0-9.]+$/.test(h)) return true;
  if (ROOT_DOMAIN && (h === ROOT_DOMAIN || h === `www.${ROOT_DOMAIN}`)) {
    return true;
  }
  return false;
}

/** True if the host is a custom/vanity domain (not under our root domain). */
export function isCustomDomain(host?: string | null): boolean {
  if (!host) return false;
  const h = hostname(host);
  if (!h.includes(".")) return false; // localhost / single label
  if (/^[0-9.]+$/.test(h)) return false; // bare IPv4
  if (ROOT_DOMAIN && (h === ROOT_DOMAIN || h.endsWith(`.${ROOT_DOMAIN}`))) {
    return false; // under our platform domain → Tier 1, not custom
  }
  return true;
}

// In-memory cache for custom-domain lookups (host → slug | null).
const domainResolveCache = new Map<string, string | null>();

/**
 * Tier 1 + Tier 2 — resolve a host to a tenant slug. Parses subdomains
 * directly; for custom domains, calls the backend's public resolve endpoint
 * (cached). Returns `null` if no tenant can be determined.
 */
export async function resolveTenantSlug(
  host?: string | null,
): Promise<string | null> {
  const parsed = getTenantSlugFromHost(host);
  if (parsed) return parsed;
  if (!host || !isCustomDomain(host)) return null;

  const h = hostname(host);
  if (domainResolveCache.has(h)) return domainResolveCache.get(h) ?? null;

  try {
    const res = await fetch(
      `${API_BASE_URL}/public/tenants/resolve?host=${encodeURIComponent(h)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) {
      domainResolveCache.set(h, null);
      return null;
    }
    const json = (await res.json()) as { data?: { slug?: string } };
    const slug = json?.data?.slug ?? null;
    domainResolveCache.set(h, slug);
    return slug;
  } catch {
    return null;
  }
}

/** Client-only, sync (Tier 1 only) — for cookie/header fallbacks. */
export function getClientTenantSlug(): string | null {
  if (typeof window === "undefined") return null;
  return getTenantSlugFromHost(window.location.host);
}

/** Client-only, async (Tier 1 + Tier 2) — for the login/signup flow. */
export function resolveClientTenantSlug(): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  return resolveTenantSlug(window.location.host);
}
