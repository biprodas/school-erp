import { generateKeyPairSync, randomBytes, sign, type KeyObject } from 'crypto';
import {
  GOOGLE_JWKS_URL,
  GOOGLE_TOKEN_URL,
  type FetchFn,
} from './google-oidc.client';

export interface FakeGoogleUser {
  sub: string;
  email: string;
  emailVerified?: boolean;
  name?: string;
}

/**
 * Google's endpoints for tests: an RSA key published as JWKS, and a token
 * endpoint that answers codes minted by `authorize()` with signed ID tokens.
 * Provide `fake.fetch` as `GOOGLE_FETCH`.
 */
export class FakeGoogle {
  readonly kid = 'test-key';
  readonly clientId: string;
  private readonly privateKey: KeyObject;
  private readonly publicKey: KeyObject;
  private readonly codes = new Map<
    string,
    { user: FakeGoogleUser; nonce: string }
  >();
  tokenRequests: URLSearchParams[] = [];

  constructor(clientId = 'test-client-id') {
    this.clientId = clientId;
    const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
    this.privateKey = pair.privateKey;
    this.publicKey = pair.publicKey;
  }

  /** A signed ID token; `overrides` replace standard claims. */
  idToken(claims: Record<string, unknown>, kid = this.kid): string {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', kid, typ: 'JWT' };
    const payload = {
      iss: 'https://accounts.google.com',
      aud: this.clientId,
      iat: now,
      exp: now + 3600,
      ...claims,
    };
    const enc = (o: object) =>
      Buffer.from(JSON.stringify(o)).toString('base64url');
    const data = `${enc(header)}.${enc(payload)}`;
    const signature = sign('RSA-SHA256', Buffer.from(data), this.privateKey);
    return `${data}.${signature.toString('base64url')}`;
  }

  /**
   * The user consents on Google's page: reads `state` and `nonce` from the
   * authorize URL and returns the callback query Google would send.
   */
  authorize(
    authorizeUrl: string,
    user: FakeGoogleUser,
  ): { state: string; code: string } {
    const url = new URL(authorizeUrl);
    const code = randomBytes(8).toString('hex');
    this.codes.set(code, { user, nonce: url.searchParams.get('nonce')! });
    return { state: url.searchParams.get('state')!, code };
  }

  fetch: FetchFn = (input, init) => {
    const url = typeof input === 'string' ? input : (input as URL).toString();
    if (url === GOOGLE_JWKS_URL) {
      const jwk = this.publicKey.export({ format: 'jwk' });
      return Promise.resolve(
        new Response(
          JSON.stringify({ keys: [{ ...jwk, kid: this.kid, alg: 'RS256' }] }),
          { headers: { 'cache-control': 'public, max-age=3600' } },
        ),
      );
    }
    if (url === GOOGLE_TOKEN_URL) {
      const body = new URLSearchParams((init as RequestInit).body as string);
      this.tokenRequests.push(body);
      const grant = this.codes.get(body.get('code') ?? '');
      if (!grant) {
        return Promise.resolve(new Response('{}', { status: 400 }));
      }
      this.codes.delete(body.get('code')!);
      const { user, nonce } = grant;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id_token: this.idToken({
              sub: user.sub,
              email: user.email,
              email_verified: user.emailVerified ?? true,
              name: user.name ?? 'Google User',
              nonce,
            }),
          }),
        ),
      );
    }
    return Promise.reject(new Error(`unexpected fetch ${url}`));
  };
}
