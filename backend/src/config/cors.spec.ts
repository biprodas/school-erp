import { parseCorsOrigins } from './cors';

const allows = (origins: ReturnType<typeof parseCorsOrigins>, origin: string) =>
  origins === true ||
  origins.some((o) => (typeof o === 'string' ? o === origin : o.test(origin)));

describe('parseCorsOrigins', () => {
  it('allows any origin when unset (development only)', () => {
    expect(parseCorsOrigins(undefined)).toBe(true);
    expect(parseCorsOrigins(' ')).toBe(true);
  });

  it('keeps exact origins', () => {
    const origins = parseCorsOrigins('http://localhost:3000, https://app.io');
    expect(allows(origins, 'http://localhost:3000')).toBe(true);
    expect(allows(origins, 'https://app.io')).toBe(true);
    expect(allows(origins, 'https://evil.io')).toBe(false);
  });

  it('matches one subdomain label for a *. entry', () => {
    const origins = parseCorsOrigins('https://*.example.com');
    expect(allows(origins, 'https://acme.example.com')).toBe(true);
    expect(allows(origins, 'https://example.com')).toBe(false);
    expect(allows(origins, 'https://a.b.example.com')).toBe(false);
    expect(allows(origins, 'https://acme.example.com.evil.io')).toBe(false);
    expect(allows(origins, 'http://acme.example.com')).toBe(false);
  });

  it('rejects wildcards anywhere else', () => {
    expect(() => parseCorsOrigins('https://acme.*.com')).toThrow(
      /only a leading/,
    );
  });
});
