import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Identity for Phase 1a (PRD 5.1, 6.3):
 * - accounts are identified by email and/or phone (`chk_users_email_or_phone`),
 *   both unique when present; existing emails are stored lower-case;
 * - sign-in lockout (`failed_login_count`, `locked_until`), forced password
 *   change (`must_change_password`), `phone_verified_at` for SMS OTP (1b);
 * - `user_sessions`: rotating refresh tokens grouped in families. Identity
 *   data read through the root connection only, so no RLS and no app-role
 *   grant (its `org_id` is nullable: null = platform session).
 */
export class IdentityAndSessions1792330000003 implements MigrationInterface {
  name = 'IdentityAndSessions1792330000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "users" SET "email" = lower(trim("email")) WHERE "email" <> lower(trim("email"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "phone" character varying(16)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_a000cca60bcf04454e727699490" UNIQUE ("phone")`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "phone_verified_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "must_change_password" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "failed_login_count" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "locked_until" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "chk_users_email_or_phone" CHECK ("email" IS NOT NULL OR "phone" IS NOT NULL)`,
    );

    await queryRunner.query(
      `CREATE TABLE "user_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "org_id" uuid, "refresh_hash" character(64) NOT NULL, "family_id" uuid NOT NULL, "user_agent" character varying(255), "ip" character varying(64), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "last_used_at" TIMESTAMP WITH TIME ZONE NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_e93e031a5fed190d4789b6bfd83" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_user_sessions_refresh_hash" ON "user_sessions" ("refresh_hash") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_sessions_user" ON "user_sessions" ("user_id", "org_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_sessions_family" ON "user_sessions" ("family_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD CONSTRAINT "FK_e9658e959c490b0a634dfc54783" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD CONSTRAINT "FK_557f86752249f7f1852984dcea3" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  /** Phone-only accounts can't survive the old NOT NULL email; down refuses them. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user_sessions"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "chk_users_email_or_phone"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "locked_until"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "failed_login_count"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "must_change_password"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "phone_verified_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "UQ_a000cca60bcf04454e727699490"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "phone"`);
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL`,
    );
  }
}
