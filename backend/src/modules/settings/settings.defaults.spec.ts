import {
  DEFAULT_SETTINGS,
  mergeOverrides,
  mergeSettings,
  withDefaults,
} from './settings.defaults';
import { SETTINGS_SECTIONS } from './settings.types';

describe('settings defaults', () => {
  it('has a default for every section', () => {
    expect(Object.keys(DEFAULT_SETTINGS).sort()).toEqual(
      [...SETTINGS_SECTIONS].sort(),
    );
  });

  it('fills unsaved sections and fields with the defaults', () => {
    const values = withDefaults({ locale: { language: 'bn' } });

    expect(values.locale).toEqual({
      ...DEFAULT_SETTINGS.locale,
      language: 'bn',
    });
    expect(values.fees).toEqual(DEFAULT_SETTINGS.fees);
  });

  it('does not share nested objects with the defaults', () => {
    const values = withDefaults({});
    values.profile.letterhead.showLogo = false;
    expect(DEFAULT_SETTINGS.profile.letterhead.showLogo).toBe(true);
  });
});

describe('mergeSettings', () => {
  const base = DEFAULT_SETTINGS.profile;

  it('merges nested objects key by key', () => {
    const merged = mergeSettings(base, {
      letterhead: { showEiin: false },
      colors: { primary: '#123456' },
    });

    expect(merged.letterhead).toEqual({ ...base.letterhead, showEiin: false });
    expect(merged.colors).toEqual({ primary: '#123456', secondary: null });
  });

  it('replaces arrays and lets null clear a field', () => {
    const merged = mergeSettings(
      { ...DEFAULT_SETTINGS.locale, weekendDays: ['friday', 'saturday'] },
      { weekendDays: ['friday'] },
    );
    expect(merged.weekendDays).toEqual(['friday']);
    expect(
      mergeSettings({ ...base, phone: '017' }, { phone: null }).phone,
    ).toBeNull();
  });

  it('keeps the base for undefined values and drops unknown keys', () => {
    const merged = mergeSettings(DEFAULT_SETTINGS.fees, {
      billingDay: undefined,
      retired: 1,
    });
    expect(merged).toEqual(DEFAULT_SETTINGS.fees);
  });

  it('never replaces a nested object with an array, scalar or null', () => {
    const merged = mergeSettings(base, {
      address: [],
      colors: 'red',
      letterhead: null,
    });
    expect(merged.address).toEqual(base.address);
    expect(merged.colors).toEqual(base.colors);
    expect(merged.letterhead).toEqual(base.letterhead);
  });
});

describe('mergeOverrides', () => {
  const shape = DEFAULT_SETTINGS.profile;

  it('keeps only what was changed, merging into earlier overrides', () => {
    const stored = { phone: '017', letterhead: { showEiin: false } };
    const overrides = mergeOverrides(shape, stored, {
      letterhead: { tagline: 'Light' },
      email: undefined,
    });

    expect(overrides).toEqual({
      phone: '017',
      letterhead: { showEiin: false, tagline: 'Light' },
    });
    // The stored value is not modified in place.
    expect(stored.letterhead).toEqual({ showEiin: false });
  });

  it('stores null (cleared) and replaces arrays', () => {
    expect(mergeOverrides(shape, { phone: '017' }, { phone: null })).toEqual({
      phone: null,
    });
    expect(
      mergeOverrides(
        DEFAULT_SETTINGS.locale,
        { weekendDays: ['friday', 'saturday'] },
        { weekendDays: [] },
      ),
    ).toEqual({ weekendDays: [] });
  });

  it('starts from nothing and drops unknown keys and non-object nesting', () => {
    expect(
      mergeOverrides(shape, null, {
        retired: 1,
        address: [],
        colors: { primary: '#123456' },
      }),
    ).toEqual({ colors: { primary: '#123456' } });
  });

  it('lets later default changes reach the school', () => {
    const overrides = mergeOverrides(DEFAULT_SETTINGS.fees, null, {
      graceDays: 5,
    });
    const newDefaults = { ...DEFAULT_SETTINGS.fees, billingDay: 3 };
    expect(mergeSettings(newDefaults, overrides)).toEqual({
      ...newDefaults,
      graceDays: 5,
    });
  });
});
