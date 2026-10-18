import { Inject, Injectable } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { AuthTokenType } from '~/common/tokens/auth-token-type.enum';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { AuthToken } from '../entities/auth-token.entity';

/**
 * Tokens in the shared `auth_tokens` table issued by the current org. The
 * repository is org-scoped (via `orgId`), so platform-issued tokens and other
 * schools' tokens are never found or redeemed here.
 */
@Injectable()
export class AuthTokenRepository extends BaseTenantRepository<AuthToken> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, AuthToken, 'AuthToken');
  }

  /** Look up by hash AND type — never let one token kind redeem another. */
  findByHash(
    tokenHash: string,
    type: AuthTokenType,
  ): Promise<AuthToken | null> {
    return this.repo.findOne({ where: { tokenHash, type } });
  }

  /**
   * Marks the token used only if it is still unused. Returns false when a
   * concurrent request redeemed it first, so a token is never redeemed twice.
   */
  async consume(id: string): Promise<boolean> {
    const result = await this.repo.update(
      { id, usedAt: IsNull() },
      { usedAt: new Date() },
    );
    return (result.affected ?? 0) === 1;
  }
}
