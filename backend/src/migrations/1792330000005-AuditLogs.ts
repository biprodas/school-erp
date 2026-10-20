import { MigrationInterface, QueryRunner } from 'typeorm';

const ORG_EXPR = `NULLIF(current_setting('app.org_id', true), '')::uuid`;

const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;

/**
 * Audit logs (backend plan 4.5):
 *
 * - `audit_logs`, per school, under the `org_isolation` RLS policy. The app
 *   role gets SELECT and INSERT only, so rows can't be edited or deleted
 *   through the app (they still go with their school on an org delete,
 *   which the owner connection performs).
 * - `platform_audit_logs`, platform actions and platform sign-in events.
 *   No RLS and no app-role grant: only the root connection reads or writes
 *   it. `org_id` has no foreign key, so a school's deletion stays logged.
 * - The seeded `admin` role of every org gains `audit:read`.
 */
export class AuditLogs1792330000005 implements MigrationInterface {
  name = 'AuditLogs1792330000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "actor_user_id" uuid, "actor_type" character varying(16) NOT NULL, "action" character varying(64) NOT NULL, "entity_type" character varying(64), "entity_id" character varying(64), "before" jsonb, "after" jsonb, "ip" character varying(64), "user_agent" character varying(512), "request_id" character varying(64), "impersonator_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8f3655b4b607ce3e7a3fb90678" ON "audit_logs" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_logs_org_action" ON "audit_logs" ("org_id", "action", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_logs_org_actor" ON "audit_logs" ("org_id", "actor_user_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_logs_org_entity" ON "audit_logs" ("org_id", "entity_type", "entity_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_logs_org_created" ON "audit_logs" ("org_id", "created_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_8f3655b4b607ce3e7a3fb906784" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "platform_audit_logs" ("org_id" uuid, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "actor_user_id" uuid, "actor_type" character varying(16) NOT NULL, "action" character varying(64) NOT NULL, "entity_type" character varying(64), "entity_id" character varying(64), "before" jsonb, "after" jsonb, "ip" character varying(64), "user_agent" character varying(512), "request_id" character varying(64), "impersonator_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_df9143ce2f97b20833a989e1e8c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_platform_audit_logs_action" ON "platform_audit_logs" ("action", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_platform_audit_logs_actor" ON "platform_audit_logs" ("actor_user_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_platform_audit_logs_org" ON "platform_audit_logs" ("org_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_platform_audit_logs_created" ON "platform_audit_logs" ("created_at") `,
    );

    await queryRunner.query(
      `ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `CREATE POLICY org_isolation ON "audit_logs" USING (org_id = ${ORG_EXPR}) WITH CHECK (org_id = ${ORG_EXPR})`,
    );
    const role = process.env.DB_APP_USERNAME?.trim();
    if (role) {
      // Append-only for the app: no UPDATE, no DELETE.
      await queryRunner.query(
        `GRANT SELECT, INSERT ON "audit_logs" TO ${quoteIdent(role)}`,
      );
    } else {
      console.warn('AuditLogs: DB_APP_USERNAME is not set, skipping grants.');
    }

    await queryRunner.query(
      `UPDATE "roles" SET "permissions" = array_append("permissions", 'audit:read'), "updated_at" = now()
       WHERE "is_system" AND "name" = 'admin' AND NOT ('audit:read' = ANY("permissions"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "roles" SET "permissions" = array_remove("permissions", 'audit:read')`,
    );
    // Dropping a table also drops its policy, indexes, FKs and grants.
    await queryRunner.query(`DROP TABLE "platform_audit_logs"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
  }
}
