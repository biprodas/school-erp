import { randomBytes } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { normalizeEmail, normalizePhone } from '~/common/identity/identifier';
import { hashPassword } from '~/common/identity/password';
import { generateToken, hashToken } from '~/common/tokens/secure-token.util';
import { MailService } from '~/shared/mail/mail.service';
import { AppHosts } from '~/shared/hosts/app-hosts';
import { User } from '~/modules/users/entities/user.entity';
import { UserStatus } from '~/modules/users/enums/user-status.enum';
import { OrganizationType } from '~/modules/organizations/enums/organization-type.enum';
import { OrganizationService } from '~/modules/organizations/services/organization.service';
import {
  type SlugCheck,
  SlugService,
} from '~/modules/organizations/services/slug.service';
import { PlatformAuthService } from '~/modules/auth/services/platform-auth.service';
import { SessionService } from '~/modules/auth/services/session.service';
import {
  IdentityProvider,
  UserIdentity,
} from '~/modules/auth/entities/user-identity.entity';
import { SignupRequest } from '../entities/signup-request.entity';
import { StartSignupDto } from '../dto/signup.dto';
import {
  type GoogleSignupClaims,
  SignupTicketService,
} from './signup-ticket.service';

/** How long the emailed signup link works. */
export const SIGNUP_TTL_MS = 24 * 60 * 60 * 1000;

/** Where the owner lands on the new school's host. */
const ONBOARDING_PATH = '/onboarding';

/** Accounts that may never own a new school. */
const BLOCKED_STATUSES = new Set<string>([
  UserStatus.SUSPENDED,
  UserStatus.DEACTIVATED,
  UserStatus.BANNED,
]);

export type StartSignupResult =
  | { status: 'verification_sent'; email: string }
  | ({ status: 'created' } & CompletedSignup);

/** What an emailed link will create, shown before it is used. */
export interface SignupPreview {
  schoolName: string;
  slug: string;
  ownerName: string;
  email: string;
  expiresAt: Date;
  /** Whether the requested address is still free, with alternatives. */
  slugCheck: SlugCheck;
  /** The email already has an active account, which keeps its password. */
  existingAccount: boolean;
}

export interface CompletedSignup {
  orgId: string;
  orgSlug: string;
  /** One-time code for the school host's `/auth/handoff` (60 s). */
  code: string;
  /** `https://<slug>.<root>/auth/handoff?code=…&next=/onboarding`. */
  redirectUrl: string;
}

/**
 * Self-serve school signup (PRD 6.2, 7.1; doc/domains-and-routing.md 4).
 *
 * 1. `start` validates the form (a reserved or taken slug is refused with
 *    suggestions), stores the request and emails a link. It never reserves
 *    the slug, and answers the same whether or not the email has an account.
 * 2. `verify` uses the link: in one transaction it re-checks the slug,
 *    creates or links the owner's account (an existing active account keeps
 *    its password) and creates the school on a 30-day trial. The owner then
 *    moves to the school's host with a handoff code, already signed in.
 *
 * With a Google ticket (Google already verified the email) `start` goes
 * straight to step 2.
 */
@Injectable()
export class SignupService {
  private readonly logger = new Logger(SignupService.name);

  constructor(
    @InjectRepository(SignupRequest)
    private readonly requests: Repository<SignupRequest>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly slugs: SlugService,
    private readonly organizations: OrganizationService,
    private readonly platformAuth: PlatformAuthService,
    private readonly sessions: SessionService,
    private readonly tickets: SignupTicketService,
    private readonly mail: MailService,
    private readonly hosts: AppHosts,
  ) {}

  async start(dto: StartSignupDto): Promise<StartSignupResult> {
    const email = normalizeEmail(dto.email);
    const phone = dto.phone ? normalizePhone(dto.phone) : null;
    // Fail early with suggestions; checked again when the school is created.
    await this.slugs.assertAvailable(dto.slug);

    const google = dto.googleTicket
      ? this.tickets.verify(dto.googleTicket)
      : null;
    if (google && google.email !== email) {
      throw new BadRequestException({
        message: 'Use the email address you signed in to Google with',
        code: 'GOOGLE_EMAIL_MISMATCH',
      });
    }

    const base = {
      schoolName: dto.schoolName.trim(),
      type: dto.type ?? OrganizationType.SCHOOL,
      slug: dto.slug,
      ownerName: dto.ownerName.trim(),
      email,
      phone,
      passwordHash: dto.password ? await hashPassword(dto.password) : null,
    };

    if (google) {
      const completed = await this.dataSource.transaction(async (manager) => {
        const request = await manager.save(
          manager.create(SignupRequest, {
            ...base,
            tokenHash: null,
            expiresAt: new Date(),
          }),
        );
        return this.complete(manager, request, google);
      });
      return { status: 'created', ...(await this.handOff(completed)) };
    }

    const rawToken = generateToken();
    await this.requests.save(
      this.requests.create({
        ...base,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + SIGNUP_TTL_MS),
      }),
    );
    await this.mail.sendSignupVerificationEmail(email, {
      name: base.ownerName,
      schoolName: base.schoolName,
      schoolHost: this.hosts.schoolHost(base.slug),
      link: this.hosts.url(
        this.hosts.rootDomain,
        `/signup/verify?token=${rawToken}`,
      ),
    });
    return { status: 'verification_sent', email };
  }

  /**
   * What an emailed link will create, without using it (mail scanners open
   * links, so only `verify` uses one up).
   */
  async preview(rawToken: string): Promise<SignupPreview> {
    const request = usable(
      await this.requests.findOne({
        where: { tokenHash: hashToken(rawToken) },
      }),
    );
    const [slugCheck, account] = await Promise.all([
      this.slugs.check(request.slug),
      this.dataSource.getRepository(User).findOne({
        where: { email: request.email },
        select: { id: true, status: true },
      }),
    ]);
    return {
      schoolName: request.schoolName,
      slug: request.slug,
      ownerName: request.ownerName,
      email: request.email,
      expiresAt: request.expiresAt,
      slugCheck,
      existingAccount: account?.status === UserStatus.ACTIVE,
    };
  }

  /**
   * Uses an emailed link. `slug` replaces the requested one (the client
   * offers it when that one was taken in the meantime).
   */
  async verify(rawToken: string, slug?: string): Promise<CompletedSignup> {
    const completed = await this.dataSource.transaction(async (manager) => {
      const request = usable(
        await manager
          .getRepository(SignupRequest)
          .createQueryBuilder('r')
          .addSelect('r.passwordHash')
          .where('r.tokenHash = :hash', { hash: hashToken(rawToken) })
          .setLock('pessimistic_write')
          .getOne(),
      );
      if (slug) request.slug = slug;
      return this.complete(manager, request);
    });
    return this.handOff(completed);
  }

  /**
   * Creates or links the owner and creates the school, inside the caller's
   * transaction.
   */
  private async complete(
    manager: EntityManager,
    request: SignupRequest,
    google?: GoogleSignupClaims,
  ): Promise<{
    orgId: string;
    orgSlug: string;
    userId: string;
    signOut: boolean;
  }> {
    const { user, signOut } = await this.ownerAccount(manager, request, google);
    if (google) await this.linkGoogle(manager, user.id, google);

    const org = await this.organizations.createForSignup(manager, {
      name: request.schoolName,
      slug: request.slug,
      type: request.type,
      ownerUserId: user.id,
    });
    request.completedAt = new Date();
    request.orgId = org.id;
    // Used up: the hash is on the account now (or was never needed).
    request.passwordHash = null;
    await manager.save(request);
    return { orgId: org.id, orgSlug: org.slug, userId: user.id, signOut };
  }

  /**
   * The owner's account: a new one, or the existing account of the email.
   * An active account keeps its password. A registered but never verified
   * (PENDING) one gets the signup's password and is activated: whoever
   * registered it never proved the email, so their password and sessions
   * must not survive (`signOut`).
   */
  private async ownerAccount(
    manager: EntityManager,
    request: SignupRequest,
    google?: GoogleSignupClaims,
  ): Promise<{ user: User; signOut: boolean }> {
    const users = manager.getRepository(User);
    const now = new Date();
    const password = async () =>
      request.passwordHash ??
      (await hashPassword(randomBytes(32).toString('base64url')));

    const existing = await users.findOne({ where: { email: request.email } });
    if (existing) {
      if (BLOCKED_STATUSES.has(existing.status)) {
        throw new ForbiddenException({
          message: 'This account cannot create a school',
          code: `ACCOUNT_${existing.status.toUpperCase()}`,
        });
      }
      let signOut = false;
      if (existing.status === UserStatus.PENDING) {
        existing.password = await password();
        existing.passwordSet = request.passwordHash !== null;
        existing.mustChangePassword = false;
        existing.status = UserStatus.ACTIVE;
        signOut = true;
      }
      existing.emailVerifiedAt ??= now;
      await users.save(existing);
      return { user: existing, signOut };
    }

    // The phone may already belong to another account; it is optional and
    // unverified until Phase 1b, so the new account simply goes without.
    const phoneTaken =
      request.phone !== null &&
      (await users.exists({ where: { phone: request.phone } }));
    const user = await users.save(
      users.create({
        email: request.email,
        phone: phoneTaken ? null : request.phone,
        name: request.ownerName || google?.name || request.email,
        password: await password(),
        passwordSet: request.passwordHash !== null,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: now,
      }),
    );
    return { user, signOut: false };
  }

  private async linkGoogle(
    manager: EntityManager,
    userId: string,
    google: GoogleSignupClaims,
  ): Promise<void> {
    const identities = manager.getRepository(UserIdentity);
    const bySubject = await identities.findOne({
      where: { provider: IdentityProvider.GOOGLE, subject: google.sub },
    });
    if (bySubject) {
      if (bySubject.userId !== userId) {
        throw new ConflictException({
          message: 'This Google account is linked to another account',
          code: 'GOOGLE_ALREADY_LINKED',
        });
      }
      return;
    }
    if (
      await identities.exists({
        where: { userId, provider: IdentityProvider.GOOGLE },
      })
    ) {
      return;
    }
    await identities.save(
      identities.create({
        userId,
        provider: IdentityProvider.GOOGLE,
        subject: google.sub,
        email: google.email,
        lastUsedAt: new Date(),
      }),
    );
  }

  /** After commit: end stale sessions, then the code for the school host. */
  private async handOff(done: {
    orgId: string;
    orgSlug: string;
    userId: string;
    signOut: boolean;
  }): Promise<CompletedSignup> {
    if (done.signOut) await this.sessions.revokeAllForUser(done.userId);
    const { code } = await this.platformAuth.issueHandoff(
      done.userId,
      done.orgId,
    );
    this.logger.log(`School "${done.orgSlug}" created by self-serve signup`);
    return {
      orgId: done.orgId,
      orgSlug: done.orgSlug,
      code,
      redirectUrl: this.hosts.url(
        this.hosts.schoolHost(done.orgSlug),
        `/auth/handoff?code=${code}&next=${encodeURIComponent(ONBOARDING_PATH)}`,
      ),
    };
  }
}

/** The request behind a link that can still be used, else 400. */
function usable(request: SignupRequest | null): SignupRequest {
  if (
    !request ||
    request.completedAt ||
    request.expiresAt.getTime() < Date.now()
  ) {
    throw new BadRequestException({
      message: 'This signup link is invalid or has expired',
      code: 'INVALID_SIGNUP_LINK',
    });
  }
  return request;
}
