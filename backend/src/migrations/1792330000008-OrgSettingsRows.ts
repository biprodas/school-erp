import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Every organization gets its `org_settings` row up front (new ones get it
 * in their creation transaction, `OrgSettingsSeeder`), so settings writes
 * lock and update an existing row instead of racing to create it. Empty
 * sections mean "all defaults". Runs as the table owner, so RLS doesn't
 * apply.
 */
export class OrgSettingsRows1792330000008 implements MigrationInterface {
  name = 'OrgSettingsRows1792330000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "org_settings" ("org_id")
       SELECT "id" FROM "organizations"
       ON CONFLICT ("org_id") DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The code before this created rows on a school's first change: drop
    // the ones nobody has saved anything into.
    await queryRunner.query(
      `DELETE FROM "org_settings"
       WHERE "profile" IS NULL AND "locale" IS NULL AND "numbering" IS NULL
         AND "portal" IS NULL AND "results" IS NULL AND "attendance" IS NULL
         AND "fees" IS NULL AND "notifications" IS NULL AND "security" IS NULL`,
    );
  }
}
