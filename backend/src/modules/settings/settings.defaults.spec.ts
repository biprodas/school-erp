import {
  DEFAULT_SETTINGS,
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
});
