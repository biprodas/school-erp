import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { AuthTokenType } from '~/common/tokens/auth-token-type.enum';
import { generateToken, hashToken } from '~/common/tokens/secure-token.util';
import { ACTIVATION_TTL_MS } from '~/common/tokens/token-ttl.constants';
import { MailService } from '~/shared/mail/mail.service';
import { AuthToken } from '../entities/auth-token.entity';
import { Membership } from '~/modules/memberships/entities/membership.entity';
import { MembershipRole } from '~/modules/memberships/enums/membership-role.enum';
import { MembershipStatus } from '~/modules/memberships/enums/membership-status.enum';
import { Role } from '~/modules/rbac/entities/role.entity';
import { UserRole } from '~/modules/rbac/entities/user-role.entity';
import { ADMIN_ROLE_NAME } from '~/modules/rbac/system-roles.seed';

export interface ProvisionOwnerInput {
  orgId: string;
  userId: string;
}

export interface OwnerRecipient {
  email: string;
  name: string;
}

/**
 * Makes a (global) user the school-admin owner of an organization and mints
 * a one-time activation token so they can set their password and activate
 * their membership.
 *
 * Runs on a caller-supplied `EntityManager` (the owner connection, usually
 * inside the organization create/transfer transaction), so it is unaffected
 * by row-level security and commits atomically with the caller. Idempotent:
 * re-running just (re)asserts the owner membership + admin role and mints a
 * fresh token. Send the email with {@link sendActivationEmail} after commit.
 */
@Injectable()
export class OwnerProvisioningService {
  private readonly logger = new Logger(OwnerProvisioningService.name);

  constructor(private readonly mailService: MailService) {}

  async provisionOwner(
    manager: EntityManager,
    { orgId, userId }: ProvisionOwnerInput,
  ): Promise<{ token: string }> {
    const memberships = manager.getRepository(Membership);
    const roles = manager.getRepository(Role);
    const userRoles = manager.getRepository(UserRole);
    const tokens = manager.getRepository(AuthToken);

    // Owner membership: school admin; must activate unless already active.
    const membership =
      (await memberships.findOne({ where: { orgId, userId } })) ??
      memberships.create({ orgId, userId, status: MembershipStatus.PENDING });
    membership.role = MembershipRole.OWNER;
    membership.isAdmin = true;
    await memberships.save(membership);

    // Grant the seeded `admin` role (best-effort; isAdmin already bootstraps
    // full access if the role is missing).
    const adminRole = await roles.findOne({
      where: { orgId, name: ADMIN_ROLE_NAME },
    });
    if (adminRole) {
      const existing = await userRoles.findOne({
        where: { orgId, userId, roleId: adminRole.id },
      });
      if (!existing) {
        await userRoles.save(
          userRoles.create({ orgId, userId, roleId: adminRole.id }),
        );
      }
    }

    // Single-use, expiring activation token (only its hash is stored).
    const rawToken = generateToken();
    await tokens.save(
      tokens.create({
        userId,
        orgId,
        tokenHash: hashToken(rawToken),
        type: AuthTokenType.ACTIVATION,
        expiresAt: new Date(Date.now() + ACTIVATION_TTL_MS),
        usedAt: null,
      }),
    );

    this.logger.log(`Provisioned owner ${userId} in organization ${orgId}`);
    return { token: rawToken };
  }

  /**
   * Delivers the activation link. Best-effort: MailService swallows transport
   * errors, and the raw token is still returned to the API caller.
   */
  async sendActivationEmail(
    recipient: OwnerRecipient,
    orgSlug: string,
    token: string,
  ): Promise<void> {
    await this.mailService.sendActivationEmail(
      recipient.email,
      recipient.name,
      token,
      orgSlug,
    );
  }
}
