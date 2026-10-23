import { randomBytes } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import { normalizeEmail } from '~/common/identity/identifier';
import { hashPassword } from '~/common/identity/password';
import { generateToken, hashToken } from '~/common/tokens/secure-token.util';
import { AppHosts } from '~/shared/hosts/app-hosts';
import { User } from '~/modules/users/entities/user.entity';
import { UserStatus } from '~/modules/users/enums/user-status.enum';
import { isOperationalOrganization } from '~/modules/organizations/enums/organization-status.enum';
import {
  normalizeHostname,
  OrganizationService,
} from '~/modules/organizations/services/organization.service';
import {
  OAuthIntent,
  OAuthState,
} from '~/modules/auth/entities/oauth-state.entity';
import { IdentityProvider } from '~/modules/auth/entities/user-identity.entity';
import { IdentityService } from '~/modules/auth/services/identity.service';
import { PlatformAuthService } from '~/modules/auth/services/platform-auth.service';
import { SessionService } from '~/modules/auth/services/session.service';
import { PlatformAuditService } from '~/modules/audit/services/platform-audit.service';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';
import { SignupTicketService } from '~/modules/signup/services/signup-ticket.service';
import {
  type GoogleClaims,
  GoogleOidcClient,
  GoogleTokenError,
} from './google-oidc.client';

/** How long a sign-in may take between start and callback. */
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

const HOSTNAME = /^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/;

/** Where a `return` host leads. */
export interface ReturnTarget {
  host: string;
  kind: 'school' | 'platform' | 'apex';
  orgId: string | null;
}

/** Error codes sent back to the frontend as `?error=` / `?google_error=`. */
export const GOOGLE_ERRORS = {
  /** No account, or not a member of that school: one answer for both. */
  NO_ACCOUNT: 'google_no_account',
  EMAIL_UNVERIFIED: 'google_email_unverified',
  EXPIRED: 'google_expired',
  CANCELLED: 'google_cancelled',
  FAILED: 'google_failed',
  IN_USE: 'google_in_use',
  ALREADY_LINKED: 'google_already_linked',
} as const;

/**
 * "Continue with Google" (PRD 6.3, doc/domains-and-routing.md 5a). Every
 * host starts here and Google calls back to one fixed URL on the product
 * domain; the browser then returns to the starting host with a one-time
 * handoff code, so subdomains and custom domains need no Google setup.
 *
 * Google only signs in to existing accounts (by linked identity, else by
 * verified email, which links it) and never creates a school membership.
 * At signup it verifies the owner's email instead of the emailed link.
 * Identity and state data use the root connection.
 */
@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);

  constructor(
    @InjectRepository(OAuthState)
    private readonly states: Repository<OAuthState>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly google: GoogleOidcClient,
    private readonly hosts: AppHosts,
    private readonly organizations: OrganizationService,
    private readonly identities: IdentityService,
    private readonly platformAuth: PlatformAuthService,
    private readonly sessions: SessionService,
    private readonly tickets: SignupTicketService,
    private readonly audit: PlatformAuditService,
  ) {}

  assertEnabled(): void {
    if (!this.google.enabled) {
      throw new NotFoundException({
        message: 'Google sign-in is not enabled',
        code: 'GOOGLE_SIGNIN_DISABLED',
      });
    }
  }

  /**
   * `GET /oauth/google/start`: the Google URL to redirect to. `return` must
   * be a host we serve (a school's subdomain or verified custom domain, the
   * admin host, or the product domain for signup), so this can't be used
   * as an open redirect.
   */
  async start(input: {
    returnHost?: string;
    next?: string;
    intent?: string;
  }): Promise<string> {
    this.assertEnabled();
    const intent = (input.intent ?? OAuthIntent.SIGNIN) as OAuthIntent;
    if (intent !== OAuthIntent.SIGNIN && intent !== OAuthIntent.SIGNUP) {
      throw new BadRequestException({
        message: 'intent must be signin or signup',
        code: 'INVALID_INTENT',
      });
    }
    const target = await this.resolveReturnHost(input.returnHost);
    if (intent === OAuthIntent.SIGNUP && target.kind !== 'apex') {
      throw new BadRequestException({
        message: 'Signup starts on the product domain',
        code: 'INVALID_RETURN_HOST',
      });
    }
    const fallback =
      intent === OAuthIntent.SIGNUP
        ? '/signup'
        : target.kind === 'school'
          ? '/dashboard'
          : '/';
    return this.createState({
      target,
      intent,
      next: safeNext(input.next, fallback),
      userId: null,
    });
  }

  /**
   * Starts linking Google to a signed-in account (account settings). The
   * return host must belong to the caller's school (`orgId`) or, for the
   * platform realm (`orgId` null), be a platform host.
   */
  async startLink(input: {
    userId: string;
    orgId: string | null;
    returnHost?: string;
    next?: string;
  }): Promise<{ url: string }> {
    this.assertEnabled();
    const target = await this.resolveReturnHost(input.returnHost);
    const sameRealm = input.orgId
      ? target.orgId === input.orgId
      : target.kind !== 'school';
    if (!sameRealm) {
      throw new BadRequestException({
        message: 'Return to the host you are signed in on',
        code: 'INVALID_RETURN_HOST',
      });
    }
    const url = await this.createState({
      target,
      intent: OAuthIntent.LINK,
      next: safeNext(input.next, '/'),
      userId: input.userId,
    });
    return { url };
  }

  /**
   * `GET /oauth/google/callback`: where to send the browser. Never throws;
   * failures go back to the starting host with an error code.
   */
  async callback(query: {
    state?: string;
    code?: string;
    error?: string;
  }): Promise<string> {
    const state = query.state ? await this.consumeState(query.state) : null;
    if (!state) {
      return this.hosts.url(
        this.hosts.rootDomain,
        `/login?error=${GOOGLE_ERRORS.EXPIRED}`,
      );
    }
    if (query.error || !query.code) {
      return this.failure(state, GOOGLE_ERRORS.CANCELLED);
    }

    let claims: GoogleClaims;
    try {
      claims = await this.google.signIn(
        query.code,
        state.codeVerifier,
        state.nonce,
      );
    } catch (err) {
      this.logger.warn(
        `Google sign-in refused: ${err instanceof GoogleTokenError ? err.message : String(err)}`,
      );
      return this.failure(state, GOOGLE_ERRORS.FAILED);
    }
    if (!claims.emailVerified || !claims.email) {
      return this.failure(state, GOOGLE_ERRORS.EMAIL_UNVERIFIED);
    }

    try {
      switch (state.intent) {
        case OAuthIntent.LINK:
          return await this.completeLink(state, claims);
        case OAuthIntent.SIGNUP:
          return this.completeSignup(state, claims);
        default:
          return await this.completeSignIn(state, claims);
      }
    } catch (err) {
      this.logger.error('Google callback failed', err as Error);
      return this.failure(state, GOOGLE_ERRORS.FAILED);
    }
  }

  // --- Callback outcomes ----------------------------------------------------

  private async completeSignIn(
    state: OAuthState,
    claims: GoogleClaims,
  ): Promise<string> {
    const user = await this.findAccount(claims);
    if (!user) return this.failure(state, GOOGLE_ERRORS.NO_ACCOUNT);

    let code: string;
    try {
      code = state.orgId
        ? (await this.platformAuth.issueHandoff(user.id, state.orgId)).code
        : await this.platformCode(user);
    } catch (err) {
      // Not a member here, or not allowed to sign in: the same answer as an
      // unknown account, so the result doesn't reveal other schools.
      if (err instanceof ForbiddenException) {
        return this.failure(state, GOOGLE_ERRORS.NO_ACCOUNT);
      }
      throw err;
    }
    await this.audit.record({
      action: AUDIT_ACTIONS.GOOGLE_SIGNIN,
      orgId: state.orgId,
      entityType: 'user',
      entityId: user.id,
      actorUserId: user.id,
      after: { host: state.returnHost },
    });
    return this.hosts.url(
      state.returnHost,
      `/auth/handoff?code=${code}&next=${encodeURIComponent(state.next)}`,
    );
  }

  private completeSignup(state: OAuthState, claims: GoogleClaims): string {
    const ticket = this.tickets.issue({
      email: claims.email,
      name: claims.name,
      sub: claims.sub,
    });
    return this.hosts.url(
      state.returnHost,
      withParam(state.next, 'google_ticket', ticket),
    );
  }

  private async completeLink(
    state: OAuthState,
    claims: GoogleClaims,
  ): Promise<string> {
    try {
      await this.identities.link(
        state.userId!,
        IdentityProvider.GOOGLE,
        claims.sub,
        normalizeEmail(claims.email),
      );
    } catch (err) {
      if (err instanceof ConflictException) {
        const code = (err.getResponse() as { code?: string }).code;
        return this.failure(
          state,
          code === 'IDENTITY_IN_USE'
            ? GOOGLE_ERRORS.IN_USE
            : GOOGLE_ERRORS.ALREADY_LINKED,
        );
      }
      throw err;
    }
    await this.audit.record({
      action: AUDIT_ACTIONS.IDENTITY_LINKED,
      orgId: state.orgId,
      entityType: 'user',
      entityId: state.userId!,
      actorUserId: state.userId,
      after: { provider: IdentityProvider.GOOGLE },
    });
    return this.hosts.url(
      state.returnHost,
      withParam(state.next, 'google', 'linked'),
    );
  }

  /**
   * The account Google proves: by linked identity, else by verified email
   * (linking it now and marking the email verified). A registered but never
   * verified (PENDING) account is activated with a fresh unknown password
   * and its sessions end: whoever registered it never proved the email.
   */
  private async findAccount(claims: GoogleClaims): Promise<User | null> {
    const linked = await this.identities.findBySubject(
      IdentityProvider.GOOGLE,
      claims.sub,
    );
    if (linked) {
      await this.identities.touch(linked.id);
      return this.users.findOne({ where: { id: linked.userId } });
    }

    const email = normalizeEmail(claims.email);
    const user = await this.users.findOne({ where: { email } });
    if (!user) return null;

    let signOut = false;
    if (user.status === UserStatus.PENDING) {
      user.password = await hashPassword(randomBytes(32).toString('base64url'));
      user.passwordSet = false;
      user.mustChangePassword = false;
      user.status = UserStatus.ACTIVE;
      signOut = true;
    }
    user.emailVerifiedAt ??= new Date();
    await this.users.save(user);
    if (signOut) await this.sessions.revokeAllForUser(user.id);

    try {
      await this.identities.link(
        user.id,
        IdentityProvider.GOOGLE,
        claims.sub,
        email,
      );
      await this.audit.record({
        action: AUDIT_ACTIONS.IDENTITY_LINKED,
        entityType: 'user',
        entityId: user.id,
        actorUserId: user.id,
        after: { provider: IdentityProvider.GOOGLE, via: 'verified_email' },
      });
    } catch (err) {
      // The account has another Google account linked; this one still
      // proved the account's email, so it may sign in without linking.
      if (!(err instanceof ConflictException)) throw err;
    }
    return user;
  }

  private async platformCode(user: User): Promise<string> {
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('You cannot sign in');
    }
    return (await this.platformAuth.issuePlatformHandoff(user.id)).code;
  }

  // --- State ----------------------------------------------------------------

  private async createState(input: {
    target: ReturnTarget;
    intent: OAuthIntent;
    next: string;
    userId: string | null;
  }): Promise<string> {
    // Opportunistic cleanup: states are useless a minute after expiry.
    await this.states.delete({
      expiresAt: LessThan(new Date(Date.now() - 60_000)),
    });
    const state = generateToken();
    const codeVerifier = randomBytes(48).toString('base64url');
    const nonce = randomBytes(16).toString('hex');
    await this.states.save(
      this.states.create({
        stateHash: hashToken(state),
        codeVerifier,
        nonce,
        returnHost: input.target.host,
        orgId: input.target.orgId,
        next: input.next,
        intent: input.intent,
        userId: input.userId,
        expiresAt: new Date(Date.now() + OAUTH_STATE_TTL_MS),
        usedAt: null,
      }),
    );
    return this.google.authorizeUrl({ state, codeVerifier, nonce });
  }

  /** Single use: returns the state only for the request that claims it. */
  private async consumeState(raw: string): Promise<OAuthState | null> {
    const state = await this.states.findOne({
      where: { stateHash: hashToken(raw) },
    });
    if (!state || state.expiresAt.getTime() < Date.now()) return null;
    const claimed = await this.states.update(
      { id: state.id, usedAt: IsNull() },
      { usedAt: new Date() },
    );
    return (claimed.affected ?? 0) === 1 ? state : null;
  }

  async resolveReturnHost(raw?: string): Promise<ReturnTarget> {
    const invalid = () =>
      new BadRequestException({
        message: 'Unknown return host',
        code: 'INVALID_RETURN_HOST',
      });
    const host = raw ? normalizeHostname(raw) : '';
    if (!host || !HOSTNAME.test(host)) throw invalid();

    if (host === this.hosts.rootDomain) {
      return { host, kind: 'apex', orgId: null };
    }
    if (host === this.hosts.adminHost) {
      return { host, kind: 'platform', orgId: null };
    }
    const slug = this.hosts.slugOf(host);
    const org = slug
      ? await this.organizations.findBySlug(slug)
      : await this.organizations.findByDomain(host);
    if (!org || !isOperationalOrganization(org.status)) throw invalid();
    return { host, kind: 'school', orgId: org.id };
  }

  /** Back to the starting host with an error the frontend can show. */
  private failure(state: OAuthState, code: string): string {
    if (state.intent === OAuthIntent.LINK) {
      return this.hosts.url(
        state.returnHost,
        withParam(state.next, 'google_error', code),
      );
    }
    const page = state.intent === OAuthIntent.SIGNUP ? '/signup' : '/login';
    return this.hosts.url(state.returnHost, `${page}?error=${code}`);
  }
}

/**
 * A same-host path for `next`: starts with one `/`, no scheme or host, no
 * backslashes or control characters; otherwise `fallback`.
 */
export function safeNext(next: unknown, fallback: string): string {
  if (typeof next !== 'string' || !next || next.length > 512) return fallback;
  // eslint-disable-next-line no-control-regex
  if (!next.startsWith('/') || /^\/[/\\]|\\|[\u0000-\u001f]/.test(next)) {
    return fallback;
  }
  try {
    const url = new URL(next, 'http://same.host');
    if (url.host !== 'same.host') return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

/** `path` with `name=value` added to its query (before any `#`). */
function withParam(path: string, name: string, value: string): string {
  const url = new URL(path, 'http://same.host');
  url.searchParams.set(name, value);
  return `${url.pathname}${url.search}${url.hash}`;
}
