import type { OrgSettingsValues } from './settings.types';

/** How long a school's settings are reused per process. */
export const SETTINGS_CACHE_TTL_MS = 60_000;

const cache = new Map<
  string,
  { value: OrgSettingsValues; expiresAt: number }
>();

/**
 * Bumped by every invalidation: a reader takes the generation before its
 * database read and only caches what it read if no write invalidated the
 * school in between (otherwise it could cache the old row for a full TTL).
 */
let counter = 0;
let epoch = 0;
const generations = new Map<string, number>();
const currentGeneration = (orgId: string): number =>
  generations.get(orgId) ?? epoch;

/** Freezes `value` and everything in it, so shared cached objects stay as read. */
export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

/**
 * In-memory settings per school, shared by every request and singleton in
 * the process. A write invalidates its own process at once; other processes
 * pick the change up within {@link SETTINGS_CACHE_TTL_MS}. Cached values are
 * deep-frozen.
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
  /** Take this before reading the row, and pass it to {@link set}. */
  generation: currentGeneration,
  /** Caches `value` unless the school was invalidated since `generation`. */
  set(orgId: string, value: OrgSettingsValues, generation: number): void {
    if (currentGeneration(orgId) !== generation) return;
    cache.set(orgId, {
      value: deepFreeze(value),
      expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS,
    });
  },
  invalidate(orgId?: string): void {
    if (orgId) {
      cache.delete(orgId);
      generations.set(orgId, ++counter);
    } else {
      cache.clear();
      generations.clear();
      epoch = ++counter;
    }
  },
};
