import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { TenantConnectionService } from '~/tenancy/tenant-connection.service';
import { Role } from '../rbac/entities/role.entity';
import { UserRole } from '../rbac/entities/user-role.entity';
import { ADMIN_ROLE_NAME } from '../rbac/system-roles.seed';
import { User } from '../users/entities/user.entity';
import { UserStatus } from '../users/enums/user-status.enum';
import { ActivationToken } from './entities/activation-token.entity';

export interface ProvisionOwnerInput {
  email: string;
  name: string;
  platformUserId: string;
}

/** Days an activation link stays valid. */
const ACTIVATION_TTL_DAYS = 7;

export const hashActivationToken = (raw: string): string =>
  createHash('sha256').update(raw).digest('hex');

/**
 * Provisions a tenant-admin user inside a tenant schema for a platform owner
 * and mints a one-time activation token so they can set their password.
 *
 * Runs outside any request context using a scoped connection (the same pattern
 * as `RbacSeederService`). Idempotent: re-running for an existing user just
 * (re)assigns the admin role and mints a fresh token.
 */
@Injectable()
export class OwnerProvisioningService {
  private readonly logger = new Logger(OwnerProvisioningService.name);

  constructor(
    private readonly tenantConnectionService: TenantConnectionService,
  ) {}

  async provisionOwner(
    schemaName: string,
    { email, name, platformUserId }: ProvisionOwnerInput,
  ): Promise<{ token: string }> {
    const proxy =
      await this.tenantConnectionService.getScopedConnection(schemaName);
    try {
      const userRepo = proxy.getRepository(User);
      const roleRepo = proxy.getRepository(Role);
      const userRoleRepo = proxy.getRepository(UserRole);
      const tokenRepo = proxy.getRepository(ActivationToken);

      // Create (or link) the tenant user.
      let user = await userRepo.findOne({ where: { email } });
      if (!user) {
        user = await userRepo.save(
          userRepo.create({
            email,
            name,
            password: '',
            status: UserStatus.PENDING,
            isAdmin: true,
            platformUserId,
          }),
        );
      } else if (platformUserId && !user.platformUserId) {
        user.platformUserId = platformUserId;
        await userRepo.save(user);
      }

      // Grant the seeded tenant `admin` role (best-effort; isAdmin already
      // bootstraps full access if the role is missing).
      const adminRole = await roleRepo.findOne({
        where: { name: ADMIN_ROLE_NAME },
      });
      if (adminRole) {
        const existing = await userRoleRepo.findOne({
          where: { userId: user.id, roleId: adminRole.id },
        });
        if (!existing) {
          await userRoleRepo.save(
            userRoleRepo.create({ userId: user.id, roleId: adminRole.id }),
          );
        }
      }

      // Mint a single-use, expiring activation token (store only its hash).
      const rawToken = randomBytes(32).toString('hex');
      const expiresAt = new Date(
        Date.now() + ACTIVATION_TTL_DAYS * 24 * 60 * 60 * 1000,
      );
      await tokenRepo.save(
        tokenRepo.create({
          userId: user.id,
          tokenHash: hashActivationToken(rawToken),
          expiresAt,
          usedAt: null,
        }),
      );

      this.logger.log(`Provisioned owner ${email} in schema ${schemaName}`);
      return { token: rawToken };
    } finally {
      await proxy.release();
    }
  }
}
