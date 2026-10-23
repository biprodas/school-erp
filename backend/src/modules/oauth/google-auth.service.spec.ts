import { safeNext } from './google-auth.service';

describe('safeNext (open-redirect guard)', () => {
  it.each([
    ['/dashboard', '/dashboard'],
    ['/students?class=5#top', '/students?class=5#top'],
    ['/a/../b', '/b'],
  ])('keeps same-host path %s', (next, expected) => {
    expect(safeNext(next, '/fallback')).toBe(expected);
  });

  it.each([
    'https://evil.example.com/x',
    '//evil.example.com',
    '/\\evil.example.com',
    '\\\\evil.example.com',
    'javascript:alert(1)',
    'dashboard',
    '/x\n/y',
    '',
    undefined,
    '/' + 'a'.repeat(600),
  ])('replaces %p with the fallback', (next) => {
    expect(safeNext(next, '/fallback')).toBe('/fallback');
  });
});
