/**
 * Tenant resolution from the request host (subdomain-based).
 *
 * `acme.lvh.me:3000` -> "acme".  Bare hosts (`lvh.me`, `localhost`) and
 * reserved labels resolve to `null` (= no tenant / platform context).
 */

const RESERVED_LABELS = new Set(["www", "api", "app", "platform"]);
const ROOT_HOSTS = new Set(["lvh", "localhost", "127", "0"]);

export function getTenantSlugFromHost(host?: string | null): string | null {
  if (!host) return null;

  // Strip port, then split into labels.
  const hostname = host.split(":")[0].toLowerCase();
  const labels = hostname.split(".");

  // Need at least `slug.root` (e.g. acme.lvh.me -> 3 labels, acme.localhost -> 2).
  if (labels.length < 2) return null;

  const slug = labels[0];
  if (!slug || RESERVED_LABELS.has(slug) || ROOT_HOSTS.has(slug)) return null;

  // Validate against the backend slug pattern.
  if (!/^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$/.test(slug)) return null;

  return slug;
}

/** Client-only: derive the tenant slug from `window.location.host`. */
export function getClientTenantSlug(): string | null {
  if (typeof window === "undefined") return null;
  return getTenantSlugFromHost(window.location.host);
}
