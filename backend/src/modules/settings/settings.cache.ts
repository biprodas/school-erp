import type { OrgSettingsValues } from './settings.types';

/** How long a school's settings are reused per process. */
export const SETTINGS_CACHE_TTL_MS = 60_000;

const cache = new Map<
  string,
  { value: OrgSettingsValues; expiresAt: number }
>();

/**
 * In-memory settings per school, shared by every request and singleton in
 * the process. A write invalidates its own process at once; other processes
 * pick the change up within {@link SETTINGS_CACHE_TTL_MS}.
 */
export const settingsCache = {
  get(orgId: string): OrgSettingsValues | undefined {
    const hit = cache.get(orgId);
    if (!hit) return undefined;
    if (hit.expiresAt <= Date.now()) {
      cache.delete(orgId);
      return undefined;
    }
    return hit.value;
  },
  set(orgId: string, value: OrgSettingsValues): void {
    cache.set(orgId, { value, expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS });
  },
  invalidate(orgId?: string): void {
    if (orgId) cache.delete(orgId);
    else cache.clear();
  },
};
