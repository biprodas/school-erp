import { MigrationInterface, QueryRunner } from 'typeorm';

const ORG_EXPR = `NULLIF(current_setting('app.org_id', true), '')::uuid`;

/**
 * Removes the stakeholders module, which is not part of the PRD:
 * - `stakeholders:*` permission keys from every stored role (the catalog no
 *   longer has them, so a role still listing them couldn't be saved again);
 * - the seeded `stakeholder` system role and its assignments;
 * - the `stakeholders` table (its grants go with it).
 */
export class DropStakeholders1792330000000 implements MigrationInterface {
  name = 'DropStakeholders1792330000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "roles"
       SET "permissions" = ARRAY(
         SELECT p FROM unnest("permissions") AS p WHERE p NOT LIKE 'stakeholders:%'
       )
       WHERE EXISTS (
         SELECT 1 FROM unnest("permissions") AS p WHERE p LIKE 'stakeholders:%'
       )`,
    );
    await queryRunner.query(
      `DELETE FROM "user_roles" WHERE "role_id" IN (
         SELECT "id" FROM "roles" WHERE "is_system" AND "name" = 'stakeholder'
       )`,
    );
    await queryRunner.query(
      `DELETE FROM "roles" WHERE "is_system" AND "name" = 'stakeholder'`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "stakeholders"`);
  }

  /**
   * Recreates the empty table as InitialSchema and SoftDeleteAndSingleFlags
   * left it, with its RLS policy and app-role grant. Removed roles and
   * permission keys are not restored.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "stakeholders" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "type" character varying(32) NOT NULL, "organization" character varying(160), "email" character varying, "phone" character varying(40), "address" text, "notes" text, "status" character varying NOT NULL DEFAULT 'active', "user_id" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "PK_74b5b503a4a44039a4a4b117ec6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2218d7efed1410cc2dcf806b97" ON "stakeholders" ("org_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "stakeholders" ADD CONSTRAINT "FK_2218d7efed1410cc2dcf806b975" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "stakeholders" ADD CONSTRAINT "FK_1159b452acb3cbfd3a126795a65" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE public."stakeholders" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `CREATE POLICY org_isolation ON public."stakeholders" USING (org_id = ${ORG_EXPR}) WITH CHECK (org_id = ${ORG_EXPR})`,
    );
    const appRole = process.env.DB_APP_USERNAME?.trim();
    if (appRole) {
      await queryRunner.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON public."stakeholders" TO "${appRole.replace(/"/g, '""')}"`,
      );
    }
  }
}
