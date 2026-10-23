import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M2, academic setup and staff directory (backend plan 6.1, 6.3, 6.6):
 *
 * - New org-scoped tables `shifts`, `rooms`, `terms` and
 *   `class_subject_components`, each with RLS (`org_isolation`) and DML for
 *   the app role (skipped when `DB_APP_USERNAME` is not set).
 * - Curriculum: `subjects.is_optional` goes; `class_subjects` gets
 *   `subject_type` (from `is_compulsory`: true → compulsory, false →
 *   optional) and `subject_group_id`; enrollments get `subject_group_id`;
 *   `student_subjects.is_fourth_subject` (at most one per enrollment).
 * - Staff: employees get `name_bn`, `nid` (encrypted by the app),
 *   `photo_file_id` and `employment_type`; designations a
 *   `default_role_id` used when inviting staff.
 * - System roles get the new keys (frozen copy of `system-roles.seed.ts`):
 *   terms/shifts/rooms read for every academic-setup reader, create/update
 *   and `academic_years:rollover` for principal, everything for admin.
 *
 * Per-session sections and effective-dated teachers follow in
 * `PerSessionSections`.
 */
const ORG_EXPR = `NULLIF(current_setting('app.org_id', true), '')::uuid`;

const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;

function appRole(): string | null {
  const name = process.env.DB_APP_USERNAME?.trim();
  return name ? quoteIdent(name) : null;
}

const NEW_TABLES = ['shifts', 'rooms', 'terms', 'class_subject_components'];

const crud = (
  resource: string,
  actions = ['read', 'create', 'update', 'delete'],
) => actions.map((a) => `${resource}:${a}`);

const SETUP_READ = [
  ...crud('terms', ['read']),
  ...crud('shifts', ['read']),
  ...crud('rooms', ['read']),
];

/** Keys added to each system role (frozen at this migration). */
const ROLE_KEYS: Record<string, string[]> = {
  admin: [
    'academic_years:rollover',
    ...crud('terms'),
    ...crud('shifts'),
    ...crud('rooms'),
  ],
  principal: [
    'academic_years:rollover',
    ...crud('terms', ['read', 'create', 'update']),
    ...crud('shifts', ['read', 'create', 'update']),
    ...crud('rooms', ['read', 'create', 'update']),
  ],
  teacher: SETUP_READ,
  class_teacher: SETUP_READ,
  committee_member: SETUP_READ,
};

export class AcademicSetup1792350000000 implements MigrationInterface {
  name = 'AcademicSetup1792350000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Shifts, rooms, terms --------------------------------------------
    await queryRunner.query(
      `CREATE TABLE "shifts" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(60) NOT NULL, "start_time" TIME NOT NULL, "end_time" TIME NOT NULL, "sort_order" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_84d692e367e4d6cdf045828768c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_57926b2bb6e552a0779a651bf9" ON "shifts" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_shifts_org_name" ON "shifts" ("org_id", "name") `,
    );
    await queryRunner.query(
      `ALTER TABLE "shifts" ADD CONSTRAINT "FK_57926b2bb6e552a0779a651bf92" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "rooms" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(60) NOT NULL, "building" character varying(120), "capacity" integer, "type" character varying(16) NOT NULL DEFAULT 'classroom', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0368a2d7c215f2d0458a54933f2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_edcb1a5af5aeed69ee5e6a6acd" ON "rooms" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_rooms_org_name" ON "rooms" ("org_id", "name") `,
    );
    await queryRunner.query(
      `ALTER TABLE "rooms" ADD CONSTRAINT "FK_edcb1a5af5aeed69ee5e6a6acd7" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "terms" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "academic_year_id" uuid NOT NULL, "name" character varying(80) NOT NULL, "start_date" date NOT NULL, "end_date" date NOT NULL, "sort_order" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_33b6fe77d6ace7ff43cc8a65958" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_55cbf9296acd78f205e5f3781c" ON "terms" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_terms_org_year_name" ON "terms" ("org_id", "academic_year_id", "name") `,
    );
    await queryRunner.query(
      `ALTER TABLE "terms" ADD CONSTRAINT "FK_55cbf9296acd78f205e5f3781c6" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "terms" ADD CONSTRAINT "FK_733590da28e000d72a406ff95a9" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // --- Curriculum ------------------------------------------------------
    await queryRunner.query(`ALTER TABLE "subjects" DROP COLUMN "is_optional"`);
    await queryRunner.query(
      `ALTER TABLE "class_subjects" ADD "subject_type" character varying(16) NOT NULL DEFAULT 'compulsory'`,
    );
    await queryRunner.query(
      `UPDATE "class_subjects" SET "subject_type" = 'optional' WHERE NOT "is_compulsory"`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_subjects" DROP COLUMN "is_compulsory"`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_subjects" ADD "subject_group_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_subjects" ADD CONSTRAINT "FK_1f5eae666d051ea23f203696528" FOREIGN KEY ("subject_group_id") REFERENCES "subject_groups"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "class_subject_components" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "class_subject_id" uuid NOT NULL, "component" character varying(16) NOT NULL, "full_marks" integer NOT NULL, "pass_marks" integer, "sort_order" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_dd569abe1531a66ec9cd744bbc3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a41909fa5407523b1b1ee72537" ON "class_subject_components" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_class_subject_components" ON "class_subject_components" ("org_id", "class_subject_id", "component") `,
    );
    await queryRunner.query(
      `ALTER TABLE "class_subject_components" ADD CONSTRAINT "FK_a41909fa5407523b1b1ee72537e" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_subject_components" ADD CONSTRAINT "FK_0d8e3870eb1e4b81150d316270c" FOREIGN KEY ("class_subject_id") REFERENCES "class_subjects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "student_enrollments" ADD "subject_group_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_enrollments" ADD CONSTRAINT "FK_421fdc79db2155c98813c313557" FOREIGN KEY ("subject_group_id") REFERENCES "subject_groups"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_subjects" ADD "is_fourth_subject" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_student_subjects_fourth" ON "student_subjects" ("org_id", "student_enrollment_id") WHERE "is_fourth_subject"`,
    );

    // --- Staff directory -------------------------------------------------
    await queryRunner.query(
      `ALTER TABLE "employees" ADD "name_bn" character varying(160)`,
    );
    await queryRunner.query(`ALTER TABLE "employees" ADD "nid" text`);
    await queryRunner.query(`ALTER TABLE "employees" ADD "photo_file_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "employees" ADD "employment_type" character varying(16)`,
    );
    await queryRunner.query(
      `ALTER TABLE "employees" ADD CONSTRAINT "FK_11a7b9c85bb52d3e7d5bc25952a" FOREIGN KEY ("photo_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "designations" ADD "default_role_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "designations" ADD CONSTRAINT "FK_555ab1c0b243349b9cd39dfaeb3" FOREIGN KEY ("default_role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    // --- RLS and grants for the new tables -------------------------------
    const role = appRole();
    for (const table of NEW_TABLES) {
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
        'AcademicSetup: DB_APP_USERNAME is not set, skipping grants.',
      );
    }

    // --- System roles ----------------------------------------------------
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

    await queryRunner.query(
      `ALTER TABLE "designations" DROP CONSTRAINT "FK_555ab1c0b243349b9cd39dfaeb3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "designations" DROP COLUMN "default_role_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "employees" DROP CONSTRAINT "FK_11a7b9c85bb52d3e7d5bc25952a"`,
    );
    for (const column of [
      'employment_type',
      'photo_file_id',
      'nid',
      'name_bn',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "employees" DROP COLUMN "${column}"`,
      );
    }

    await queryRunner.query(`DROP INDEX "public"."uq_student_subjects_fourth"`);
    await queryRunner.query(
      `ALTER TABLE "student_subjects" DROP COLUMN "is_fourth_subject"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_enrollments" DROP CONSTRAINT "FK_421fdc79db2155c98813c313557"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_enrollments" DROP COLUMN "subject_group_id"`,
    );

    // Dropping a table also drops its policy and grants.
    await queryRunner.query(`DROP TABLE "class_subject_components"`);
    await queryRunner.query(
      `ALTER TABLE "class_subjects" DROP CONSTRAINT "FK_1f5eae666d051ea23f203696528"`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_subjects" DROP COLUMN "subject_group_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_subjects" ADD "is_compulsory" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `UPDATE "class_subjects" SET "is_compulsory" = ("subject_type" = 'compulsory')`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_subjects" DROP COLUMN "subject_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subjects" ADD "is_optional" boolean NOT NULL DEFAULT false`,
    );

    await queryRunner.query(`DROP TABLE "terms"`);
    await queryRunner.query(`DROP TABLE "rooms"`);
    await queryRunner.query(`DROP TABLE "shifts"`);
  }
}
