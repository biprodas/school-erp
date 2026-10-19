import { MigrationInterface, QueryRunner } from 'typeorm';

const ORG_EXPR = `NULLIF(current_setting('app.org_id', true), '')::uuid`;
const TABLES = ['jobs', 'files', 'numbering_sequences', 'idempotency_keys'];

const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;

/**
 * Tenant tables for the M0 infrastructure: background job tracking, stored
 * file metadata, per-school number sequences and idempotency keys. Each gets
 * the `org_isolation` RLS policy and app-role DML, like every tenanted table.
 */
export class InfrastructureTables1792330000002 implements MigrationInterface {
  name = 'InfrastructureTables1792330000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "jobs" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" character varying(64) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'queued', "progress" smallint NOT NULL DEFAULT '0', "result" jsonb, "error" text, "attempts" integer NOT NULL DEFAULT '0', "created_by" uuid, "file_id" uuid, "started_at" TIMESTAMP WITH TIME ZONE, "finished_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cf0a6c42b72fcc7f7c237def345" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_658a4a5c43bbc0ed322be2bea7" ON "jobs" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_jobs_org_created_by" ON "jobs" ("org_id", "created_by", "created_at") `,
    );

    await queryRunner.query(
      `CREATE TABLE "files" ("org_id" uuid NOT NULL, "id" uuid NOT NULL, "key" character varying(512) NOT NULL, "original_name" character varying(255) NOT NULL, "mime" character varying(127) NOT NULL, "size" integer NOT NULL, "sha256" character(64) NOT NULL, "purpose" character varying(32) NOT NULL, "uploaded_by" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6c16b9093a142e0e7613b04a3d9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6dcf2eb04af438e419ca47fb8b" ON "files" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_files_key" ON "files" ("key") `,
    );

    await queryRunner.query(
      `CREATE TABLE "numbering_sequences" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "key" character varying(40) NOT NULL, "scope" character varying(60) NOT NULL DEFAULT '', "next_value" bigint NOT NULL DEFAULT '1', CONSTRAINT "PK_95a67e6b3ef63fd2f168dab09aa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_93d2b63ff23e7a79db0ae07231" ON "numbering_sequences" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_numbering_sequences_key" ON "numbering_sequences" ("org_id", "key", "scope") `,
    );

    await queryRunner.query(
      `CREATE TABLE "idempotency_keys" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "key" character varying(128) NOT NULL, "user_id" uuid, "request_hash" character(64) NOT NULL, "status_code" integer, "response" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_8ad20779ad0411107a56e53d0f6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1eaac38e984e753ad348af8d3f" ON "idempotency_keys" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_idempotency_keys_expires_at" ON "idempotency_keys" ("expires_at") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_idempotency_keys_org_key" ON "idempotency_keys" ("org_id", "key") `,
    );

    await queryRunner.query(
      `ALTER TABLE "jobs" ADD CONSTRAINT "FK_658a4a5c43bbc0ed322be2bea73" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "files" ADD CONSTRAINT "FK_6dcf2eb04af438e419ca47fb8b9" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "numbering_sequences" ADD CONSTRAINT "FK_93d2b63ff23e7a79db0ae072316" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "idempotency_keys" ADD CONSTRAINT "FK_1eaac38e984e753ad348af8d3f9" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    const role = process.env.DB_APP_USERNAME?.trim();
    for (const table of TABLES) {
      const t = `public.${quoteIdent(table)}`;
      await queryRunner.query(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(
        `CREATE POLICY org_isolation ON ${t} USING (org_id = ${ORG_EXPR}) WITH CHECK (org_id = ${ORG_EXPR})`,
      );
      if (role) {
        await queryRunner.query(
          `GRANT SELECT, INSERT, UPDATE, DELETE ON ${t} TO ${quoteIdent(role)}`,
        );
      }
    }
    if (!role) {
      console.warn(
        'InfrastructureTables: DB_APP_USERNAME is not set, skipping grants.',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Dropping a table also drops its policy, indexes, FKs and grants.
    for (const table of [...TABLES].reverse()) {
      await queryRunner.query(`DROP TABLE "${table}"`);
    }
  }
}
