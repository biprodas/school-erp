import { ConfigService } from '@nestjs/config';
import { GoogleOidcClient, pkceChallenge } from './google-oidc.client';
import { FakeGoogle } from './google.testing';

describe('GoogleOidcClient', () => {
  let google: FakeGoogle;
  let client: GoogleOidcClient;
  const nonce = 'expected-nonce';

  beforeEach(() => {
    google = new FakeGoogle('client-1');
    const config = {
      get: () => ({
        clientId: 'client-1',
        clientSecret: 'secret',
        redirectUri: 'https://example.com/api/oauth/google/callback',
      }),
    } as unknown as ConfigService;
    client = new GoogleOidcClient(config, google.fetch);
  });

  const claims = { sub: 'g-1', email: 'a@b.com', email_verified: true, nonce };

  it('accepts a valid token and returns its claims', async () => {
    await expect(
      client.verifyIdToken(google.idToken(claims), nonce),
    ).resolves.toEqual({
      sub: 'g-1',
      email: 'a@b.com',
      emailVerified: true,
      name: '',
    });
  });

  it.each([
    ['issuer', { iss: 'https://evil.example.com' }],
    ['audience', { aud: 'another-client' }],
    ['nonce', { nonce: 'other' }],
    ['expiry', { exp: Math.floor(Date.now() / 1000) - 3600 }],
    ['issue time', { iat: Math.floor(Date.now() / 1000) + 3600 }],
  ])('rejects a bad %s', async (_, override) => {
    await expect(
      client.verifyIdToken(google.idToken({ ...claims, ...override }), nonce),
    ).rejects.toThrow();
  });

  it('reports an unverified email (callers refuse it)', async () => {
    const result = await client.verifyIdToken(
      google.idToken({ ...claims, email_verified: false }),
      nonce,
    );
    expect(result.emailVerified).toBe(false);
  });

  it('rejects a forged signature and an unknown key', async () => {
    const [h, p] = google.idToken(claims).split('.');
    const other = new FakeGoogle('client-1').idToken(claims).split('.')[2];
    await expect(
      client.verifyIdToken(`${h}.${p}.${other}`, nonce),
    ).rejects.toThrow('bad signature');
    await expect(
      client.verifyIdToken(google.idToken(claims, 'rotated-away'), nonce),
    ).rejects.toThrow('unknown key');
  });

  it('rejects alg=none and malformed tokens', async () => {
    const enc = (o: object) =>
      Buffer.from(JSON.stringify(o)).toString('base64url');
    await expect(
      client.verifyIdToken(`${enc({ alg: 'none' })}.${enc(claims)}.`, nonce),
    ).rejects.toThrow();
    await expect(client.verifyIdToken('not.a.jwt', nonce)).rejects.toThrow();
  });

  it('sends the PKCE verifier and gets claims for a code', async () => {
    const url = client.authorizeUrl({
      state: 's',
      codeVerifier: 'verifier-123',
      nonce,
    });
    expect(new URL(url).searchParams.get('code_challenge')).toBe(
      pkceChallenge('verifier-123'),
    );
    const { code } = google.authorize(url, { sub: 'g-2', email: 'x@y.com' });
    const result = await client.signIn(code, 'verifier-123', nonce);
    expect(result).toMatchObject({ sub: 'g-2', email: 'x@y.com' });
    expect(google.tokenRequests[0].get('code_verifier')).toBe('verifier-123');
    // A code works once.
    await expect(client.signIn(code, 'verifier-123', nonce)).rejects.toThrow();
  });
});
