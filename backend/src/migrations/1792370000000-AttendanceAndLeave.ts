import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M4, attendance and student leave (backend plan 8):
 *
 * - `holidays` (school-wide or for some classes).
 * - `attendance_statuses` for the school's own statuses; the five system
 *   ones (present, absent, late, leave, half_day) are code-defined.
 * - `attendance_registers` (one per section and day, or per period in
 *   period mode), `attendance_records` (one per student) and
 *   `attendance_corrections` (the original status of every change).
 * - `student_leave_requests`.
 * - `domain_events`, the outbox `attendance.submitted` is written to.
 * - RLS and app-role grants on every new table; the new permission keys on
 *   system roles (frozen copy).
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
  'attendance_corrections',
  'attendance_records',
  'attendance_registers',
  'attendance_statuses',
  'domain_events',
  'holidays',
  'student_leave_requests',
];

const MARKING = [
  'attendance:read',
  'attendance:take',
  'holidays:read',
  'student_leaves:read',
];

/** Keys added to each system role (frozen at this migration). */
const ROLE_KEYS: Record<string, string[]> = {
  admin: [
    ...MARKING,
    'attendance:edit_locked',
    'attendance_statuses:create',
    'attendance_statuses:update',
    'attendance_statuses:delete',
    'holidays:create',
    'holidays:update',
    'holidays:delete',
    'student_leaves:create',
    'student_leaves:approve',
  ],
  principal: [
    ...MARKING,
    'attendance:edit_locked',
    'attendance_statuses:create',
    'attendance_statuses:update',
    'holidays:create',
    'holidays:update',
    'student_leaves:create',
    'student_leaves:approve',
  ],
  teacher: MARKING,
  class_teacher: [
    ...MARKING,
    'student_leaves:create',
    'student_leaves:approve',
  ],
  committee_member: ['holidays:read'],
};

const CREATE_TABLES = [
  `CREATE TABLE "attendance_registers" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "section_id" uuid NOT NULL, "date" date NOT NULL, "period_id" uuid, "taken_by" uuid, "submitted_at" TIMESTAMP WITH TIME ZONE NOT NULL, "client_request_id" character varying(64), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c4734a9ebaf90b8a5ff7737bfdd" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_6c194ab799934afed3b53d240d" ON "attendance_registers"  ("org_id") `,
  `CREATE INDEX "idx_attendance_registers_org_date" ON "attendance_registers"  ("org_id", "date") `,
  `CREATE UNIQUE INDEX "uq_attendance_registers_period" ON "attendance_registers"  ("org_id", "section_id", "date", "period_id") WHERE "period_id" IS NOT NULL`,
  `CREATE UNIQUE INDEX "uq_attendance_registers_day" ON "attendance_registers"  ("org_id", "section_id", "date") WHERE "period_id" IS NULL`,
  `CREATE TABLE "attendance_records" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "register_id" uuid NOT NULL, "enrollment_id" uuid NOT NULL, "status_code" character varying(16) NOT NULL, "remark" character varying(200), "updated_by" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_946920332f5bc9efad3f3023b96" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_e2f2a10a31438f493f61234d5d" ON "attendance_records"  ("org_id") `,
  `CREATE INDEX "idx_attendance_records_enrollment" ON "attendance_records"  ("org_id", "enrollment_id") `,
  `CREATE UNIQUE INDEX "uq_attendance_records_register_enrollment" ON "attendance_records"  ("org_id", "register_id", "enrollment_id") `,
  `CREATE TABLE "attendance_corrections" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "record_id" uuid NOT NULL, "old_status" character varying(16) NOT NULL, "new_status" character varying(16) NOT NULL, "reason" text NOT NULL, "source" character varying(16) NOT NULL, "changed_by" uuid, "changed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_4774e9510f6e31573910183527d" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_b0750d45567ecd68e767451e0c" ON "attendance_corrections"  ("org_id") `,
  `CREATE INDEX "idx_attendance_corrections_record" ON "attendance_corrections"  ("org_id", "record_id") `,
  `CREATE TABLE "attendance_statuses" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying(16) NOT NULL, "label_en" character varying(60) NOT NULL, "label_bn" character varying(60) NOT NULL, "counts_as" character varying(16) NOT NULL, "symbol" character varying(3) NOT NULL, "sort_order" integer NOT NULL DEFAULT '100', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0b7d208e450d5f02b826a826d70" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_c6c4615dca38eaf2f244c2aeb7" ON "attendance_statuses"  ("org_id") `,
  `CREATE UNIQUE INDEX "uq_attendance_statuses_org_code" ON "attendance_statuses"  ("org_id", "code") `,
  `CREATE TABLE "student_leave_requests" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "enrollment_id" uuid NOT NULL, "student_id" uuid NOT NULL, "from_date" date NOT NULL, "to_date" date NOT NULL, "reason" text NOT NULL, "attachment_file_id" uuid, "status" character varying(16) NOT NULL DEFAULT 'pending', "applied_by_user_id" uuid, "decided_by" uuid, "decided_at" TIMESTAMP WITH TIME ZONE, "decision_note" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1c07e39e90d86593116f0138c81" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_804f37e16e2bacf1cdd5729866" ON "student_leave_requests"  ("org_id") `,
  `CREATE INDEX "idx_student_leave_requests_status" ON "student_leave_requests"  ("org_id", "status", "from_date") `,
  `CREATE INDEX "idx_student_leave_requests_enrollment" ON "student_leave_requests"  ("org_id", "enrollment_id", "from_date") `,
  `CREATE TABLE "domain_events" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" character varying(80) NOT NULL, "payload" jsonb NOT NULL, "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "processed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_66e0920a32dda3a89b46ee7a981" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_0782f0b84a476a9a1bd6b4c480" ON "domain_events"  ("org_id") `,
  `CREATE INDEX "idx_domain_events_pending" ON "domain_events"  ("org_id", "type", "occurred_at") WHERE "processed_at" IS NULL`,
  `CREATE TABLE "holidays" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "name_bn" character varying(120), "type" character varying(16) NOT NULL, "date_from" date NOT NULL, "date_to" date NOT NULL, "class_ids" uuid array NOT NULL DEFAULT '{}', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3646bdd4c3817d954d830881dfe" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_7bc239e0a65da4ec4038f1c34d" ON "holidays"  ("org_id") `,
  `CREATE INDEX "idx_holidays_org_dates" ON "holidays"  ("org_id", "date_from", "date_to") `,
  `CREATE UNIQUE INDEX "uq_holidays_org_name_from" ON "holidays"  ("org_id", "name", "date_from") `,
];

const FOREIGN_KEYS = [
  `ALTER TABLE "attendance_registers" ADD CONSTRAINT "FK_6c194ab799934afed3b53d240d2" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "attendance_registers" ADD CONSTRAINT "FK_f12f970d07380a4ea1ab2b7eb6e" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
  `ALTER TABLE "attendance_registers" ADD CONSTRAINT "FK_6c8e901b9f629258b1ef100e35e" FOREIGN KEY ("period_id") REFERENCES "periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
  `ALTER TABLE "attendance_records" ADD CONSTRAINT "FK_e2f2a10a31438f493f61234d5d3" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "attendance_records" ADD CONSTRAINT "FK_f6ad29cfebefa2495bfbcac762e" FOREIGN KEY ("register_id") REFERENCES "attendance_registers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "attendance_records" ADD CONSTRAINT "FK_ac1298d6bec15b271f734c4e5d6" FOREIGN KEY ("enrollment_id") REFERENCES "student_enrollments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
  `ALTER TABLE "attendance_corrections" ADD CONSTRAINT "FK_b0750d45567ecd68e767451e0cc" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "attendance_corrections" ADD CONSTRAINT "FK_97585d4836c9e601097a1c36fdb" FOREIGN KEY ("record_id") REFERENCES "attendance_records"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "attendance_statuses" ADD CONSTRAINT "FK_c6c4615dca38eaf2f244c2aeb78" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "student_leave_requests" ADD CONSTRAINT "FK_804f37e16e2bacf1cdd5729866f" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "student_leave_requests" ADD CONSTRAINT "FK_0c0b618437ca9dff1c29f382ca3" FOREIGN KEY ("enrollment_id") REFERENCES "student_enrollments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "student_leave_requests" ADD CONSTRAINT "FK_372706db60634efa4ca0c4737e3" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "domain_events" ADD CONSTRAINT "FK_0782f0b84a476a9a1bd6b4c4803" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "holidays" ADD CONSTRAINT "FK_7bc239e0a65da4ec4038f1c34d8" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
];

const DROP = [
  `ALTER TABLE "holidays" DROP CONSTRAINT "FK_7bc239e0a65da4ec4038f1c34d8"`,
  `ALTER TABLE "domain_events" DROP CONSTRAINT "FK_0782f0b84a476a9a1bd6b4c4803"`,
  `ALTER TABLE "student_leave_requests" DROP CONSTRAINT "FK_372706db60634efa4ca0c4737e3"`,
  `ALTER TABLE "student_leave_requests" DROP CONSTRAINT "FK_0c0b618437ca9dff1c29f382ca3"`,
  `ALTER TABLE "student_leave_requests" DROP CONSTRAINT "FK_804f37e16e2bacf1cdd5729866f"`,
  `ALTER TABLE "attendance_statuses" DROP CONSTRAINT "FK_c6c4615dca38eaf2f244c2aeb78"`,
  `ALTER TABLE "attendance_corrections" DROP CONSTRAINT "FK_97585d4836c9e601097a1c36fdb"`,
  `ALTER TABLE "attendance_corrections" DROP CONSTRAINT "FK_b0750d45567ecd68e767451e0cc"`,
  `ALTER TABLE "attendance_records" DROP CONSTRAINT "FK_ac1298d6bec15b271f734c4e5d6"`,
  `ALTER TABLE "attendance_records" DROP CONSTRAINT "FK_f6ad29cfebefa2495bfbcac762e"`,
  `ALTER TABLE "attendance_records" DROP CONSTRAINT "FK_e2f2a10a31438f493f61234d5d3"`,
  `ALTER TABLE "attendance_registers" DROP CONSTRAINT "FK_6c8e901b9f629258b1ef100e35e"`,
  `ALTER TABLE "attendance_registers" DROP CONSTRAINT "FK_f12f970d07380a4ea1ab2b7eb6e"`,
  `ALTER TABLE "attendance_registers" DROP CONSTRAINT "FK_6c194ab799934afed3b53d240d2"`,
  `DROP INDEX "public"."uq_holidays_org_name_from"`,
  `DROP INDEX "public"."idx_holidays_org_dates"`,
  `DROP INDEX "public"."IDX_7bc239e0a65da4ec4038f1c34d"`,
  `DROP TABLE "holidays"`,
  `DROP INDEX "public"."idx_domain_events_pending"`,
  `DROP INDEX "public"."IDX_0782f0b84a476a9a1bd6b4c480"`,
  `DROP TABLE "domain_events"`,
  `DROP INDEX "public"."idx_student_leave_requests_enrollment"`,
  `DROP INDEX "public"."idx_student_leave_requests_status"`,
  `DROP INDEX "public"."IDX_804f37e16e2bacf1cdd5729866"`,
  `DROP TABLE "student_leave_requests"`,
  `DROP INDEX "public"."uq_attendance_statuses_org_code"`,
  `DROP INDEX "public"."IDX_c6c4615dca38eaf2f244c2aeb7"`,
  `DROP TABLE "attendance_statuses"`,
  `DROP INDEX "public"."idx_attendance_corrections_record"`,
  `DROP INDEX "public"."IDX_b0750d45567ecd68e767451e0c"`,
  `DROP TABLE "attendance_corrections"`,
  `DROP INDEX "public"."uq_attendance_records_register_enrollment"`,
  `DROP INDEX "public"."idx_attendance_records_enrollment"`,
  `DROP INDEX "public"."IDX_e2f2a10a31438f493f61234d5d"`,
  `DROP TABLE "attendance_records"`,
  `DROP INDEX "public"."uq_attendance_registers_day"`,
  `DROP INDEX "public"."uq_attendance_registers_period"`,
  `DROP INDEX "public"."idx_attendance_registers_org_date"`,
  `DROP INDEX "public"."IDX_6c194ab799934afed3b53d240d"`,
  `DROP TABLE "attendance_registers"`,
];

export class AttendanceAndLeave1792370000000 implements MigrationInterface {
  name = 'AttendanceAndLeave1792370000000';

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
        'AttendanceAndLeave: DB_APP_USERNAME is not set, skipping grants.',
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
