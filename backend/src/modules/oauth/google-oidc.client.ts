import {
  createHash,
  createPublicKey,
  type JsonWebKey,
  type KeyObject,
  verify as verifySignature,
} from 'crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GoogleConfig } from '~/config';

export const GOOGLE_AUTHORIZE_URL =
  'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

/** Allowed clock difference when checking `exp`/`iat` (seconds). */
const CLOCK_SKEW_S = 60;
const DEFAULT_JWKS_TTL_MS = 60 * 60 * 1000;

/** `fetch`, injectable so tests can stub Google. */
export const GOOGLE_FETCH = Symbol('GOOGLE_FETCH');
export type FetchFn = typeof fetch;

/** What a verified Google ID token tells us. */
export interface GoogleClaims {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

/** Why an ID token was refused (for logs and tests; never shown as is). */
export class GoogleTokenError extends Error {}

/** `base64url(sha256(verifier))`, the PKCE S256 challenge. */
export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

/**
 * Google's OpenID Connect endpoints: the authorize URL, the code exchange
 * (PKCE) and ID-token verification against Google's published keys
 * (RS256; issuer, audience, expiry and nonce checked). No Google token is
 * kept: only the claims leave this class.
 */
@Injectable()
export class GoogleOidcClient {
  private readonly logger = new Logger(GoogleOidcClient.name);
  private keys: { byKid: Map<string, KeyObject>; expiresAt: number } | null =
    null;

  constructor(
    private readonly config: ConfigService,
    @Inject(GOOGLE_FETCH) private readonly fetchFn: FetchFn,
  ) {}

  private get google(): GoogleConfig {
    return this.config.get<GoogleConfig>('google')!;
  }

  get enabled(): boolean {
    return !!(this.google.clientId && this.google.clientSecret);
  }

  authorizeUrl(input: {
    state: string;
    codeVerifier: string;
    nonce: string;
  }): string {
    const params = new URLSearchParams({
      client_id: this.google.clientId!,
      redirect_uri: this.google.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state: input.state,
      nonce: input.nonce,
      code_challenge: pkceChallenge(input.codeVerifier),
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });
    return `${GOOGLE_AUTHORIZE_URL}?${params.toString()}`;
  }

  /** Exchanges the authorization code; returns the verified claims. */
  async signIn(
    code: string,
    codeVerifier: string,
    nonce: string,
  ): Promise<GoogleClaims> {
    const res = await this.fetchFn(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.google.clientId!,
        client_secret: this.google.clientSecret!,
        redirect_uri: this.google.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      }).toString(),
    });
    if (!res.ok) {
      throw new GoogleTokenError(`token endpoint answered ${res.status}`);
    }
    const body = (await res.json()) as { id_token?: string };
    if (!body.id_token) throw new GoogleTokenError('no id_token');
    return this.verifyIdToken(body.id_token, nonce);
  }

  async verifyIdToken(idToken: string, nonce: string): Promise<GoogleClaims> {
    const parts = idToken.split('.');
    if (parts.length !== 3) throw new GoogleTokenError('malformed token');
    const [headerB64, payloadB64, signatureB64] = parts;
    const header = parseJson(headerB64) as { alg?: string; kid?: string };
    if (header.alg !== 'RS256' || !header.kid) {
      throw new GoogleTokenError('unexpected algorithm');
    }
    const key = await this.key(header.kid);
    const valid = verifySignature(
      'RSA-SHA256',
      Buffer.from(`${headerB64}.${payloadB64}`),
      key,
      Buffer.from(signatureB64, 'base64url'),
    );
    if (!valid) throw new GoogleTokenError('bad signature');

    const claims = parseJson(payloadB64) as Record<string, unknown>;
    const now = Math.floor(Date.now() / 1000);
    if (!GOOGLE_ISSUERS.includes(claims.iss as string)) {
      throw new GoogleTokenError('bad issuer');
    }
    const aud = claims.aud;
    if (
      aud !== this.google.clientId &&
      !(Array.isArray(aud) && aud.includes(this.google.clientId))
    ) {
      throw new GoogleTokenError('bad audience');
    }
    if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_S < now) {
      throw new GoogleTokenError('expired');
    }
    if (typeof claims.iat === 'number' && claims.iat - CLOCK_SKEW_S > now) {
      throw new GoogleTokenError('issued in the future');
    }
    if (claims.nonce !== nonce) throw new GoogleTokenError('bad nonce');
    if (typeof claims.sub !== 'string' || !claims.sub) {
      throw new GoogleTokenError('no subject');
    }
    return {
      sub: claims.sub,
      email: typeof claims.email === 'string' ? claims.email : '',
      emailVerified:
        claims.email_verified === true || claims.email_verified === 'true',
      name: typeof claims.name === 'string' ? claims.name : '',
    };
  }

  /** Google's signing key by id; refetched when stale or unknown. */
  private async key(kid: string): Promise<KeyObject> {
    if (!this.keys || this.keys.expiresAt < Date.now()) {
      await this.loadKeys();
    } else if (!this.keys.byKid.has(kid)) {
      // Google rotated its keys since we cached them.
      await this.loadKeys();
    }
    const key = this.keys?.byKid.get(kid);
    if (!key) throw new GoogleTokenError('unknown key');
    return key;
  }

  private async loadKeys(): Promise<void> {
    const res = await this.fetchFn(GOOGLE_JWKS_URL);
    if (!res.ok) throw new GoogleTokenError(`JWKS answered ${res.status}`);
    const { keys = [] } = (await res.json()) as {
      keys?: (JsonWebKey & { kid?: string })[];
    };
    const byKid = new Map<string, KeyObject>();
    for (const jwk of keys) {
      if (!jwk.kid || jwk.kty !== 'RSA') continue;
      try {
        byKid.set(jwk.kid, createPublicKey({ key: jwk, format: 'jwk' }));
      } catch {
        this.logger.warn(`Skipping unusable Google key ${jwk.kid}`);
      }
    }
    const maxAge = /max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '');
    this.keys = {
      byKid,
      expiresAt:
        Date.now() + (maxAge ? Number(maxAge[1]) * 1000 : DEFAULT_JWKS_TTL_MS),
    };
  }
}

function parseJson(b64: string): unknown {
  try {
    return JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
  } catch {
    throw new GoogleTokenError('malformed token');
  }
}
