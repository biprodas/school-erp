import { DEFAULT_SETTINGS } from './settings.defaults';
import { settingsCache } from './settings.cache';
import type { OrgSettingsValues } from './settings.types';

const values = (): OrgSettingsValues => structuredClone(DEFAULT_SETTINGS);

describe('settingsCache', () => {
  beforeEach(() => settingsCache.invalidate());

  it('caches what was read under the current generation', () => {
    settingsCache.set('org-1', values(), settingsCache.generation('org-1'));
    expect(settingsCache.get('org-1')).toEqual(DEFAULT_SETTINGS);
  });

  it('drops a read that an invalidation overtook', () => {
    // Request B takes the generation and reads the old row...
    const generation = settingsCache.generation('org-1');
    // ...request A commits a change and invalidates...
    settingsCache.invalidate('org-1');
    // ...so B's stale value is not cached.
    settingsCache.set('org-1', values(), generation);
    expect(settingsCache.get('org-1')).toBeUndefined();
  });

  it('keeps other schools and a full clear apart', () => {
    const other = settingsCache.generation('org-2');
    settingsCache.invalidate('org-1');
    settingsCache.set('org-2', values(), other);
    expect(settingsCache.get('org-2')).toBeDefined();

    const stale = settingsCache.generation('org-3');
    settingsCache.invalidate();
    settingsCache.set('org-3', values(), stale);
    expect(settingsCache.get('org-3')).toBeUndefined();
  });

  it('deep-freezes cached values', () => {
    settingsCache.set('org-1', values(), settingsCache.generation('org-1'));
    const cached = settingsCache.get('org-1')!;
    expect(() => {
      cached.profile.letterhead.showLogo = false;
    }).toThrow(TypeError);
    expect(Object.isFrozen(cached.locale.weekendDays)).toBe(true);
  });
});
