import { parseTrustProxy } from './trust-proxy';

describe('parseTrustProxy', () => {
  it('trusts proxies on loopback and private networks by default', () => {
    expect(parseTrustProxy(undefined)).toBe('loopback, linklocal, uniquelocal');
    expect(parseTrustProxy('  ')).toBe('loopback, linklocal, uniquelocal');
  });

  it('reads booleans, hop counts and address lists', () => {
    expect(parseTrustProxy('false')).toBe(false);
    expect(parseTrustProxy('true')).toBe(true);
    expect(parseTrustProxy('2')).toBe(2);
    expect(parseTrustProxy('loopback, 10.0.0.0/8')).toBe(
      'loopback, 10.0.0.0/8',
    );
  });
});
