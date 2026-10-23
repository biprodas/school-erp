import {
  isReservedSlug,
  isValidSlug,
  RESERVED_SLUGS,
  slugCandidates,
  slugify,
} from './reserved-slugs';

describe('school slugs', () => {
  it.each([
    ['acme', true],
    ['dhaka-ideal', true],
    ['a1b', true],
    ['ab', false],
    ['-acme', false],
    ['acme-', false],
    ['acme_school', false],
    ['Acme', false],
    ['a'.repeat(40), true],
    ['a'.repeat(41), false],
  ])('%s is valid: %s', (slug, valid) => {
    expect(isValidSlug(slug)).toBe(valid);
  });

  it('reserves platform hosts and paths', () => {
    for (const s of ['www', 'api', 'admin', 'login', 'schools']) {
      expect(isReservedSlug(s)).toBe(true);
    }
    expect(isReservedSlug('acme')).toBe(false);
    // Every reserved slug would otherwise be a valid one.
    expect(RESERVED_SLUGS.every(isValidSlug)).toBe(true);
  });

  it('turns a school name into a slug', () => {
    expect(slugify('Dhaka Ideal School & College')).toBe(
      'dhaka-ideal-school-college',
    );
    expect(slugify('  Café   Élan  ')).toBe('cafe-elan');
    expect(slugify('A'.repeat(60))).toHaveLength(40);
  });

  it('suggests valid, non-reserved alternatives', () => {
    const candidates = slugCandidates('Acme');
    expect(candidates.slice(0, 4)).toEqual([
      'acme',
      'acme-school',
      'acme-bd',
      'acme-2',
    ]);
    expect(candidates.every(isValidSlug)).toBe(true);
    expect(slugCandidates('admin')).not.toContain('admin');
    expect(slugCandidates('admin')).toContain('admin-school');
  });
});
