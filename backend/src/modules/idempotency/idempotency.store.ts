import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';

/** How long a stored response is replayed. */
export const IDEMPOTENCY_TTL_HOURS = 24;

export type ClaimResult =
  | { state: 'claimed'; id: string }
  | { state: 'in_progress' }
  | { state: 'mismatch' }
  | { state: 'completed'; statusCode: number; response: unknown };

/**
 * Request-scoped access to `idempotency_keys` for the current school. Raw
 * SQL so claiming is one atomic statement (the table is still under RLS).
 */
@Injectable()
export class IdempotencyStore {
  constructor(
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  /**
   * Claims `clientKey` for this request, or reports what already holds it.
   * Keys are per user (stored as `<userId>:<key>`), so one user can never
   * replay, or probe for, another user's request. An expired row is taken
   * over.
   */
  async claim(
    clientKey: string,
    requestHash: string,
    userId: string | null,
  ): Promise<ClaimResult> {
    const key = `${userId ?? '-'}:${clientKey}`;
    const q = this.ds.getManager();
    const claimed = await q.query<Array<{ id: string }>>(
      `INSERT INTO "idempotency_keys" ("org_id", "key", "user_id", "request_hash", "expires_at")
       VALUES ($1, $2, $3, $4, now() + make_interval(hours => $5))
       ON CONFLICT ("org_id", "key") DO UPDATE
         SET "user_id" = EXCLUDED."user_id",
             "request_hash" = EXCLUDED."request_hash",
             "status_code" = NULL,
             "response" = NULL,
             "created_at" = now(),
             "expires_at" = EXCLUDED."expires_at"
         WHERE "idempotency_keys"."expires_at" < now()
       RETURNING "id"`,
      [this.ds.orgId, key, userId, requestHash, IDEMPOTENCY_TTL_HOURS],
    );
    if (claimed.length) return { state: 'claimed', id: claimed[0].id };

    const rows = await q.query<
      Array<{
        request_hash: string;
        status_code: number | null;
        response: unknown;
      }>
    >(
      `SELECT "request_hash", "status_code", "response"
       FROM "idempotency_keys" WHERE "org_id" = $1 AND "key" = $2`,
      [this.ds.orgId, key],
    );
    const row = rows[0];
    if (!row) return this.claim(clientKey, requestHash, userId); // removed meanwhile
    if (row.request_hash !== requestHash) return { state: 'mismatch' };
    if (row.status_code === null) return { state: 'in_progress' };
    return {
      state: 'completed',
      statusCode: row.status_code,
      response: row.response,
    };
  }

  async complete(id: string, statusCode: number, response: unknown) {
    await this.ds
      .getManager()
      .query(
        `UPDATE "idempotency_keys" SET "status_code" = $2, "response" = $3 WHERE "id" = $1 AND "org_id" = $4`,
        [id, statusCode, JSON.stringify(response ?? null), this.ds.orgId],
      );
  }

  /** Frees the key after a failed request so the client can retry it. */
  async release(id: string) {
    await this.ds
      .getManager()
      .query(
        `DELETE FROM "idempotency_keys" WHERE "id" = $1 AND "org_id" = $2`,
        [id, this.ds.orgId],
      );
  }
}
