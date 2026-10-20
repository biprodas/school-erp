import { apiConfig } from "~/config/api-config";

export type PublicTenant = {
  slug: string;
  name: string;
};

/**
 * Fetch public-safe info for a tenant by its slug. Server-safe (plain `fetch`,
 * no session) — used by the tenant landing page. Returns `null` when no active
 * tenant exists for the slug (backend responds 404), so the caller can render
 * a not-found page.
 */
export async function getPublicTenant(
  slug: string,
): Promise<PublicTenant | null> {
  try {
    const res = await fetch(
      `${apiConfig.baseUrl}/public/organizations/by-slug?slug=${encodeURIComponent(slug)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: PublicTenant };
    return json?.data ?? null;
  } catch {
    return null;
  }
}
