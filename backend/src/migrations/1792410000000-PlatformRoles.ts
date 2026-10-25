import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Platform access comes from `users.platform_role` alone
 * (`~/common/auth/platform-permissions`); `users.is_admin` goes. Before it
 * does, roles are aligned with the access people had, so nobody gains or
 * loses the console by surprise:
 *
 * - `is_admin` without an admin role: becomes `admin` (keeps the console).
 * - an admin role without `is_admin`: becomes `user` (never had it).
 * - no active `super_admin` left: the oldest active former admin becomes
 *   one, so somebody can still manage platform staff.
 *
 * `down` restores the column from the role.
 */
export class PlatformRoles1792410000000 implements MigrationInterface {
  name = 'PlatformRoles1792410000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "users" SET "platform_role" = 'admin'
       WHERE "is_admin" AND "platform_role" NOT IN ('super_admin', 'admin')`,
    );
    await queryRunner.query(
      `UPDATE "users" SET "platform_role" = 'user'
       WHERE NOT "is_admin" AND "platform_role" IN ('super_admin', 'admin')`,
    );
    await queryRunner.query(
      `UPDATE "users" SET "platform_role" = 'super_admin'
       WHERE "id" = (
         SELECT "id" FROM "users"
         WHERE "is_admin" AND "status" = 'active' AND "deleted_at" IS NULL
         ORDER BY "created_at" ASC
         LIMIT 1
       )
       AND NOT EXISTS (
         SELECT 1 FROM "users"
         WHERE "platform_role" = 'super_admin' AND "status" = 'active'
           AND "deleted_at" IS NULL
       )`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "is_admin"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "is_admin" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `UPDATE "users" SET "is_admin" = true
       WHERE "platform_role" IN ('super_admin', 'admin')`,
    );
  }
}
