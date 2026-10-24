import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M7, notices, notifications, portal and dashboards (backend plan 11):
 *
 * - `notices` (audience jsonb, schedule, pin, expiry, public) and
 *   `notice_reads` (read receipts).
 * - `notifications` (in-app), `notification_templates` (per-school text)
 *   and `delivery_logs` (the communication log).
 * - RLS and app-role grants on every new table; the new permission keys
 *   on system roles (frozen copy).
 *
 * `down` drops the tables with their data.
 */
const ORG_EXPR = `NULLIF(current_setting('app.org_id', true), '')::uuid`;

const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;

function appRole(): string | null {
  const name = process.env.DB_APP_USERNAME?.trim();
  return name ? quoteIdent(name) : null;
}

const NEW_ORG_TABLES = [
  'delivery_logs',
  'notice_reads',
  'notices',
  'notification_templates',
  'notifications',
];

const TEACHER = ['notices:read', 'notices:manage', 'dashboard_teacher:read'];

/** Keys added to each system role (frozen at this migration). */
const ROLE_KEYS: Record<string, string[]> = {
  admin: [
    'notices:read',
    'notices:manage',
    'communication:read',
    'communication:manage',
    'dashboard_admin:read',
    'dashboard_teacher:read',
    'dashboard_accountant:read',
  ],
  principal: [
    'notices:read',
    'notices:manage',
    'communication:read',
    'communication:manage',
    'dashboard_admin:read',
    'dashboard_accountant:read',
  ],
  accountant: ['notices:read', 'dashboard_accountant:read'],
  teacher: TEACHER,
  class_teacher: TEACHER,
  receptionist: ['notices:read', 'notices:manage'],
  librarian: ['notices:read'],
  committee_member: ['notices:read', 'dashboard_admin:read'],
};

const CREATE_TABLES = [
  `CREATE TABLE "notices" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(200) NOT NULL, "body" text NOT NULL, "attachment_file_ids" uuid array NOT NULL DEFAULT '{}', "audience" jsonb NOT NULL, "publish_at" TIMESTAMP WITH TIME ZONE NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE, "pinned" boolean NOT NULL DEFAULT false, "is_public" boolean NOT NULL DEFAULT false, "created_by" uuid, "notified_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3eb18c29da25d6935fcbe584237" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_3b9553a416df94d6a1323dd69c" ON "notices"  ("org_id") `,
  `CREATE INDEX "idx_notices_publish" ON "notices"  ("org_id", "publish_at") `,
  `CREATE TABLE "notice_reads" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "notice_id" uuid NOT NULL, "user_id" uuid NOT NULL, "read_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_510757f8a8bbe38b23f74d05776" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_b4457c206a237f2c4898bed74e" ON "notice_reads"  ("org_id") `,
  `CREATE UNIQUE INDEX "uq_notice_reads" ON "notice_reads"  ("org_id", "notice_id", "user_id") `,
  `CREATE TABLE "notifications" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "type" character varying(40) NOT NULL, "title" character varying(200) NOT NULL, "body" text NOT NULL, "link" character varying(300), "data" jsonb NOT NULL DEFAULT '{}', "read_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_324de082662023de80fdf06897" ON "notifications"  ("org_id") `,
  `CREATE INDEX "idx_notifications_unread" ON "notifications"  ("org_id", "user_id") WHERE "read_at" IS NULL`,
  `CREATE INDEX "idx_notifications_user" ON "notifications"  ("org_id", "user_id", "created_at") `,
  `CREATE TABLE "notification_templates" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "key" character varying(40) NOT NULL, "channel" character varying(16) NOT NULL, "locale" character varying(2) NOT NULL, "subject" character varying(200) NOT NULL, "body" text NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_76f0fc48b8d057d2ae7f3a2848a" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_82a533df2de9e35a3f539c9a8d" ON "notification_templates"  ("org_id") `,
  `CREATE UNIQUE INDEX "uq_notification_templates" ON "notification_templates"  ("org_id", "key", "channel", "locale") `,
  `CREATE TABLE "delivery_logs" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "channel" character varying(16) NOT NULL, "user_id" uuid, "recipient" character varying(254) NOT NULL, "template_key" character varying(40) NOT NULL, "subject" character varying(200) NOT NULL, "body" text, "link" character varying(300), "status" character varying(16) NOT NULL, "provider_message_id" character varying(200), "error" text, "attempts" integer NOT NULL DEFAULT '0', "sent_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c647802ec5e927513f2d0beec47" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_e05f5a631efc98793f18f41617" ON "delivery_logs"  ("org_id") `,
  `CREATE INDEX "idx_delivery_logs_created" ON "delivery_logs"  ("org_id", "created_at") `,
];

const FOREIGN_KEYS = [
  `ALTER TABLE "notices" ADD CONSTRAINT "FK_3b9553a416df94d6a1323dd69c0" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "notice_reads" ADD CONSTRAINT "FK_b4457c206a237f2c4898bed74e8" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "notice_reads" ADD CONSTRAINT "FK_9717ae462552000c4dad15e9bb7" FOREIGN KEY ("notice_id") REFERENCES "notices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "notice_reads" ADD CONSTRAINT "FK_1120e5b2c813bf9ee90895a1d0b" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "notifications" ADD CONSTRAINT "FK_324de082662023de80fdf068978" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "notifications" ADD CONSTRAINT "FK_9a8a82462cab47c73d25f49261f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "notification_templates" ADD CONSTRAINT "FK_82a533df2de9e35a3f539c9a8d7" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "delivery_logs" ADD CONSTRAINT "FK_e05f5a631efc98793f18f416178" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
];

const DROP = [
  `ALTER TABLE "delivery_logs" DROP CONSTRAINT "FK_e05f5a631efc98793f18f416178"`,
  `ALTER TABLE "notification_templates" DROP CONSTRAINT "FK_82a533df2de9e35a3f539c9a8d7"`,
  `ALTER TABLE "notifications" DROP CONSTRAINT "FK_9a8a82462cab47c73d25f49261f"`,
  `ALTER TABLE "notifications" DROP CONSTRAINT "FK_324de082662023de80fdf068978"`,
  `ALTER TABLE "notice_reads" DROP CONSTRAINT "FK_1120e5b2c813bf9ee90895a1d0b"`,
  `ALTER TABLE "notice_reads" DROP CONSTRAINT "FK_9717ae462552000c4dad15e9bb7"`,
  `ALTER TABLE "notice_reads" DROP CONSTRAINT "FK_b4457c206a237f2c4898bed74e8"`,
  `ALTER TABLE "notices" DROP CONSTRAINT "FK_3b9553a416df94d6a1323dd69c0"`,
  `DROP INDEX "public"."idx_delivery_logs_created"`,
  `DROP INDEX "public"."IDX_e05f5a631efc98793f18f41617"`,
  `DROP TABLE "delivery_logs"`,
  `DROP INDEX "public"."uq_notification_templates"`,
  `DROP INDEX "public"."IDX_82a533df2de9e35a3f539c9a8d"`,
  `DROP TABLE "notification_templates"`,
  `DROP INDEX "public"."idx_notifications_user"`,
  `DROP INDEX "public"."idx_notifications_unread"`,
  `DROP INDEX "public"."IDX_324de082662023de80fdf06897"`,
  `DROP TABLE "notifications"`,
  `DROP INDEX "public"."uq_notice_reads"`,
  `DROP INDEX "public"."IDX_b4457c206a237f2c4898bed74e"`,
  `DROP TABLE "notice_reads"`,
  `DROP INDEX "public"."idx_notices_publish"`,
  `DROP INDEX "public"."IDX_3b9553a416df94d6a1323dd69c"`,
  `DROP TABLE "notices"`,
];

export class NoticesAndNotifications1792400000000 implements MigrationInterface {
  name = 'NoticesAndNotifications1792400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of CREATE_TABLES) await queryRunner.query(sql);
    for (const sql of FOREIGN_KEYS) await queryRunner.query(sql);

    const role = appRole();
    for (const table of NEW_ORG_TABLES) {
      const t = `public.${quoteIdent(table)}`;
      await queryRunner.query(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(
        `CREATE POLICY org_isolation ON ${t} USING (org_id = ${ORG_EXPR}) WITH CHECK (org_id = ${ORG_EXPR})`,
      );
      if (role) {
        await queryRunner.query(
          `GRANT SELECT, INSERT, UPDATE, DELETE ON ${t} TO ${role}`,
        );
      }
    }
    if (!role) {
      console.warn(
        'NoticesAndNotifications: DB_APP_USERNAME is not set, skipping grants.',
      );
    }
    for (const [name, keys] of Object.entries(ROLE_KEYS)) {
      await queryRunner.query(
        `UPDATE "roles"
         SET "permissions" = "permissions" || ARRAY(
               SELECT k FROM unnest($2::text[]) AS k
               WHERE NOT (k = ANY("permissions"))
             ),
             "updated_at" = now()
         WHERE "is_system" AND "name" = $1`,
        [name, keys],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const all = [...new Set(Object.values(ROLE_KEYS).flat())];
    await queryRunner.query(
      `UPDATE "roles" SET "permissions" = ARRAY(
         SELECT k FROM unnest("permissions") AS k WHERE NOT (k = ANY($1::text[]))
       )`,
      [all],
    );
    for (const sql of DROP) await queryRunner.query(sql);
  }
}
