import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Moves custom domains from the single `organizations.domain` column into
 * `organization_domains` (doc/domains-and-routing.md, section 8), so a school
 * can have several hosts with ownership verification and TLS state.
 *
 * - Existing domains were set by a platform admin, so they are carried over
 *   as primary, verified and active. Their TLS state is unknown (`pending`).
 *   Hostnames are lower-cased and lose any trailing dot; if two orgs end up
 *   with the same hostname, the oldest org keeps it.
 * - The table is org-scoped: RLS (`org_isolation`) is enabled and the
 *   restricted app role gets DML on it, like every tenanted table (skipped
 *   when `DB_APP_USERNAME` is not set where migrations run).
 *
 * `down` restores each org's primary (or oldest) hostname into
 * `organizations.domain`; any other hostnames are lost.
 */
const ORG_EXPR = `NULLIF(current_setting('app.org_id', true), '')::uuid`;

const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;

function appRole(): string | null {
  const name = process.env.DB_APP_USERNAME?.trim();
  return name ? quoteIdent(name) : null;
}

export class OrganizationDomains1792321369675 implements MigrationInterface {
  name = 'OrganizationDomains1792321369675';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "organization_domains" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "hostname" character varying(253) NOT NULL, "is_primary" boolean NOT NULL DEFAULT false, "status" character varying(16) NOT NULL DEFAULT 'pending', "verification_token" character varying(64) NOT NULL, "verified_at" TIMESTAMP WITH TIME ZONE, "tls_status" character varying(16) NOT NULL DEFAULT 'pending', "last_checked_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_66c1149e9a4faf8d657161b263f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d2dc66995b92f22af4e1631243" ON "organization_domains" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_organization_domains_org_primary" ON "organization_domains" ("org_id") WHERE "is_primary"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_organization_domains_hostname" ON "organization_domains" ("hostname") `,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_domains" ADD CONSTRAINT "FK_d2dc66995b92f22af4e16312438" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(`
      INSERT INTO "organization_domains"
        ("org_id", "hostname", "is_primary", "status", "verification_token", "verified_at")
      SELECT DISTINCT ON ("hostname") "id", "hostname", true, 'active',
             replace(uuid_generate_v4()::text || uuid_generate_v4()::text, '-', ''),
             now()
      FROM (
        SELECT "id", "created_at",
               rtrim(lower(trim("domain")), '.') AS "hostname"
        FROM "organizations"
        WHERE "domain" IS NOT NULL AND trim("domain") <> ''
      ) d
      ORDER BY "hostname", "created_at"`);

    await queryRunner.query(
      `ALTER TABLE "organizations" DROP CONSTRAINT "UQ_98678ed828cc71e4f8a58c95d6b"`,
    );
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN "domain"`);

    await queryRunner.query(
      `ALTER TABLE public."organization_domains" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `CREATE POLICY org_isolation ON public."organization_domains" USING (org_id = ${ORG_EXPR}) WITH CHECK (org_id = ${ORG_EXPR})`,
    );

    const role = appRole();
    if (role) {
      await queryRunner.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON public."organization_domains" TO ${role}`,
      );
    } else {
      console.warn(
        'OrganizationDomains: DB_APP_USERNAME is not set, skipping grants.',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organizations" ADD "domain" character varying`,
    );
    await queryRunner.query(`
      UPDATE "organizations" o SET "domain" = d."hostname"
      FROM (
        SELECT DISTINCT ON ("org_id") "org_id", "hostname"
        FROM "organization_domains"
        ORDER BY "org_id", "is_primary" DESC, "created_at"
      ) d
      WHERE d."org_id" = o."id"`);
    await queryRunner.query(
      `ALTER TABLE "organizations" ADD CONSTRAINT "UQ_98678ed828cc71e4f8a58c95d6b" UNIQUE ("domain")`,
    );

    await queryRunner.query(
      `ALTER TABLE "organization_domains" DROP CONSTRAINT "FK_d2dc66995b92f22af4e16312438"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_organization_domains_hostname"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_organization_domains_org_primary"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d2dc66995b92f22af4e1631243"`,
    );
    // Dropping the table also drops its policy and grants.
    await queryRunner.query(`DROP TABLE "organization_domains"`);
  }
}
