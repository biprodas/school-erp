import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { formatNumber, type NumberingContext } from './numbering-pattern';

/**
 * Hands out sequence numbers per school, key and scope.
 *
 * `next()` is one atomic upsert that row-locks the counter until the
 * caller's transaction ends. Call it inside `ds.runInTransaction(...)`
 * together with the insert that uses the number: a rollback restores the
 * counter, so numbers are gap-free (receipts) and never reused, and
 * concurrent callers queue on the lock instead of colliding.
 */
@Injectable()
export class NumberingService {
  constructor(
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  async next(key: string, scope = ''): Promise<number> {
    const rows = await this.ds.getManager().query<Array<{ value: string }>>(
      `INSERT INTO "numbering_sequences" ("org_id", "key", "scope", "next_value")
       VALUES ($1, $2, $3, 2)
       ON CONFLICT ("org_id", "key", "scope")
       DO UPDATE SET "next_value" = "numbering_sequences"."next_value" + 1
       RETURNING "next_value" - 1 AS "value"`,
      [this.ds.orgId, key, scope],
    );
    return Number(rows[0].value);
  }

  /** `next()` rendered through a pattern, e.g. `{YY}{CLASS}{SEQ:4}`. */
  async nextFormatted(
    key: string,
    pattern: string,
    scope = '',
    ctx: NumberingContext = {},
  ): Promise<string> {
    return formatNumber(pattern, await this.next(key, scope), ctx);
  }
}
