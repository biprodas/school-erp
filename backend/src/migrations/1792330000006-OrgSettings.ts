import { MigrationInterface, QueryRunner } from 'typeorm';

const ORG_EXPR = `NULLIF(current_setting('app.org_id', true), '')::uuid`;

const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;

/**
 * Settings (backend plan 4.6):
 *
 * - `organizations` gains `type`, `plan_id` (its FK comes with `plans` in
 *   M1), `trial_ends_at`, `onboarding_completed_at`, `listed_in_directory`,
 *   `eiin`, `logo_file_id` and `parent_org_id` (unused until Phase 3); the
 *   status enum gains `trial` and `past_due`.
 * - `org_settings`, one row per school with a jsonb column per section,
 *   under the `org_isolation` RLS policy with app-role DML. Rows are created
 *   on a school's first settings change; until then defaults apply.
 * - System roles: `admin` gets `settings:read` and `settings:update`;
 *   `principal` and `committee_member` get `settings:read`.
 */
export class OrgSettings1792330000006 implements MigrationInterface {
  name = 'OrgSettings1792330000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Postgres 12+ allows ADD VALUE in a transaction; the values are only
    // used after commit.
    await queryRunner.query(
      `ALTER TYPE "public"."organizations_status_enum" ADD VALUE IF NOT EXISTS 'trial' BEFORE 'active'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."organizations_status_enum" ADD VALUE IF NOT EXISTS 'past_due' AFTER 'active'`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."organizations_type_enum" AS ENUM('school', 'college', 'madrasa', 'coaching', 'english_medium')`,
    );
    await queryRunner.query(
      `ALTER TABLE "organizations"
         ADD "type" "public"."organizations_type_enum" NOT NULL DEFAULT 'school',
         ADD "plan_id" uuid,
         ADD "trial_ends_at" TIMESTAMP WITH TIME ZONE,
         ADD "onboarding_completed_at" TIMESTAMP WITH TIME ZONE,
         ADD "listed_in_directory" boolean NOT NULL DEFAULT false,
         ADD "eiin" character varying(10),
         ADD "logo_file_id" uuid,
         ADD "parent_org_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "organizations" ADD CONSTRAINT "FK_481a9e0bcafdaf38c019445df9f" FOREIGN KEY ("parent_org_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "org_settings" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "profile" jsonb, "locale" jsonb, "numbering" jsonb, "portal" jsonb, "results" jsonb, "attendance" jsonb, "fees" jsonb, "notifications" jsonb, "security" jsonb, "updated_by" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3726dc3a3dfdcd4f0d95b330789" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0121d94625d35b2900a5f5044b" ON "org_settings" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_org_settings_org" ON "org_settings" ("org_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "org_settings" ADD CONSTRAINT "FK_0121d94625d35b2900a5f5044b7" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "org_settings" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `CREATE POLICY org_isolation ON "org_settings" USING (org_id = ${ORG_EXPR}) WITH CHECK (org_id = ${ORG_EXPR})`,
    );
    const role = process.env.DB_APP_USERNAME?.trim();
    if (role) {
      await queryRunner.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON "org_settings" TO ${quoteIdent(role)}`,
      );
    } else {
      console.warn('OrgSettings: DB_APP_USERNAME is not set, skipping grants.');
    }

    await this.grant(queryRunner, 'admin', 'settings:read');
    await this.grant(queryRunner, 'admin', 'settings:update');
    await this.grant(queryRunner, 'principal', 'settings:read');
    await this.grant(queryRunner, 'committee_member', 'settings:read');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const key of ['settings:read', 'settings:update']) {
      await queryRunner.query(
        `UPDATE "roles" SET "permissions" = array_remove("permissions", $1)`,
        [key],
      );
    }
    await queryRunner.query(`DROP TABLE "org_settings"`);
    await queryRunner.query(
      `ALTER TABLE "organizations" DROP CONSTRAINT "FK_481a9e0bcafdaf38c019445df9f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organizations"
         DROP COLUMN "parent_org_id",
         DROP COLUMN "logo_file_id",
         DROP COLUMN "eiin",
         DROP COLUMN "listed_in_directory",
         DROP COLUMN "onboarding_completed_at",
         DROP COLUMN "trial_ends_at",
         DROP COLUMN "plan_id",
         DROP COLUMN "type"`,
    );
    await queryRunner.query(`DROP TYPE "public"."organizations_type_enum"`);
    // Enum values can't be dropped in place: rebuild the type without them.
    await queryRunner.query(
      `UPDATE "organizations" SET "status" = 'active' WHERE "status" IN ('trial', 'past_due')`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."organizations_status_enum" RENAME TO "organizations_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."organizations_status_enum" AS ENUM('pending', 'active', 'inactive', 'suspended', 'archived')`,
    );
    await queryRunner.query(
      `ALTER TABLE "organizations" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "organizations" ALTER COLUMN "status" TYPE "public"."organizations_status_enum" USING "status"::text::"public"."organizations_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organizations" ALTER COLUMN "status" SET DEFAULT 'active'`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."organizations_status_enum_old"`,
    );
  }

  /** Adds a key to every org's system role of that name, once. */
  private async grant(
    queryRunner: QueryRunner,
    roleName: string,
    key: string,
  ): Promise<void> {
    await queryRunner.query(
      `UPDATE "roles" SET "permissions" = array_append("permissions", $2), "updated_at" = now()
       WHERE "is_system" AND "name" = $1 AND NOT ($2 = ANY("permissions"))`,
      [roleName, key],
    );
  }
}
