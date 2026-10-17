export interface CachedTenant {
  id: string;
  slug: string;
  status: string;
  expiresAt: number;
}

export const TENANT_SLUG_CACHE_TTL_MS = 60_000;

const cache = new Map<string, CachedTenant>();

export const tenantSlugCache = {
  get(slug: string): CachedTenant | undefined {
    return cache.get(slug);
  },
  set(slug: string, entry: CachedTenant): void {
    cache.set(slug, entry);
  },
  invalidate(slug?: string): void {
    if (slug) {
      cache.delete(slug);
    } else {
      cache.clear();
    }
  },
};

/** Separate cache for custom-domain (full host) → tenant lookups. */
const domainCache = new Map<string, CachedTenant>();

export const tenantDomainCache = {
  get(domain: string): CachedTenant | undefined {
    return domainCache.get(domain);
  },
  set(domain: string, entry: CachedTenant): void {
    domainCache.set(domain, entry);
  },
  invalidate(domain?: string): void {
    if (domain) {
      domainCache.delete(domain);
    } else {
      domainCache.clear();
    }
  },
};
