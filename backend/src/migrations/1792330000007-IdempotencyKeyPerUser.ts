import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Idempotency keys are per user, not per school: the stored key becomes
 * `<userId>:<client key>` (`-` for anonymous requests), so one user's key
 * never replays another user's stored response. The column grows to fit a
 * uuid prefix in front of a 128-character client key. Existing rows keep
 * their old form and expire within 24 hours.
 */
export class IdempotencyKeyPerUser1792330000007 implements MigrationInterface {
  name = 'IdempotencyKeyPerUser1792330000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "idempotency_keys" ALTER COLUMN "key" TYPE character varying(200)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "idempotency_keys" WHERE length("key") > 128`,
    );
    await queryRunner.query(
      `ALTER TABLE "idempotency_keys" ALTER COLUMN "key" TYPE character varying(128)`,
    );
  }
}
