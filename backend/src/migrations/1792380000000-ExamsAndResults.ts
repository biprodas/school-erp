import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M5, exams and results (backend plan 9):
 *
 * - `grading_systems` with `grade_scale_items`, and `class_grading`
 *   (a class's system per session; else the school default).
 * - `exam_types`, `exams`, `exam_subjects` with `exam_subject_components`.
 * - `mark_sheets` (one per exam subject and section, with the workflow
 *   timestamps) and `marks`.
 * - `result_definitions`, `results`, `result_subjects`.
 * - `imports.mark_sheet_id` for the marks import.
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
  'class_grading',
  'exam_subject_components',
  'exam_subjects',
  'exam_types',
  'exams',
  'grade_scale_items',
  'grading_systems',
  'mark_sheets',
  'marks',
  'result_definitions',
  'result_subjects',
  'results',
];

const EXAMS_READ = ['grading_systems:read', 'exams:read', 'results:read'];

/** Keys added to each system role (frozen at this migration). */
const ROLE_KEYS: Record<string, string[]> = {
  admin: [
    ...EXAMS_READ,
    'grading_systems:create',
    'grading_systems:update',
    'grading_systems:delete',
    'exams:create',
    'exams:update',
    'exams:delete',
    'results:enter',
    'results:verify',
    'results:approve',
    'results:publish',
    'results:reopen',
    'results:remarks',
    'report_cards:print',
  ],
  principal: [
    ...EXAMS_READ,
    'grading_systems:create',
    'grading_systems:update',
    'exams:create',
    'exams:update',
    'results:verify',
    'results:approve',
    'results:publish',
    'results:reopen',
    'report_cards:print',
  ],
  teacher: [...EXAMS_READ, 'results:enter'],
  class_teacher: [
    ...EXAMS_READ,
    'results:enter',
    'results:remarks',
    'report_cards:print',
  ],
  committee_member: ['exams:read'],
};

const CREATE_TABLES = [
  `CREATE TABLE "exam_types" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(80) NOT NULL, "default_weight" numeric(5,2) NOT NULL DEFAULT '100', "sort_order" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_aa2897f3176ef22cc87e38224cb" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_ea55e5977ccdf1c0fac62a1d50" ON "exam_types"  ("org_id") `,
  `CREATE UNIQUE INDEX "uq_exam_types_org_name" ON "exam_types"  ("org_id", "name") `,
  `CREATE TABLE "exams" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "academic_year_id" uuid NOT NULL, "term_id" uuid, "exam_type_id" uuid, "name" character varying(120) NOT NULL, "weight" numeric(5,2) NOT NULL DEFAULT '100', "start_date" date, "end_date" date, "status" character varying(16) NOT NULL DEFAULT 'draft', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b43159ee3efa440952794b4f53e" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_ebfe87241e3c3446a772f87d0b" ON "exams"  ("org_id") `,
  `CREATE UNIQUE INDEX "uq_exams_org_year_name" ON "exams"  ("org_id", "academic_year_id", "name") `,
  `CREATE TABLE "exam_subjects" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "exam_id" uuid NOT NULL, "class_subject_id" uuid NOT NULL, "class_id" uuid NOT NULL, "full_marks" integer NOT NULL, "pass_marks" integer, "sort_order" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3ea5999cbf489c3435c48690b45" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_d74e2f971eea66306e9e575731" ON "exam_subjects"  ("org_id") `,
  `CREATE INDEX "idx_exam_subjects_class" ON "exam_subjects"  ("org_id", "exam_id", "class_id") `,
  `CREATE UNIQUE INDEX "uq_exam_subjects" ON "exam_subjects"  ("org_id", "exam_id", "class_subject_id") `,
  `CREATE TABLE "exam_subject_components" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "exam_subject_id" uuid NOT NULL, "component" character varying(16) NOT NULL, "full_marks" integer NOT NULL, "pass_marks" integer, "sort_order" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_38c1e9381e8dc9436ceb85586fe" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_2ad1fd7f9a8c642a7d37da4982" ON "exam_subject_components"  ("org_id") `,
  `CREATE UNIQUE INDEX "uq_exam_subject_components" ON "exam_subject_components"  ("org_id", "exam_subject_id", "component") `,
  `CREATE TABLE "mark_sheets" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "exam_subject_id" uuid NOT NULL, "section_id" uuid NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'draft', "first_submitted_at" TIMESTAMP WITH TIME ZONE, "submitted_by" uuid, "submitted_at" TIMESTAMP WITH TIME ZONE, "verified_by" uuid, "verified_at" TIMESTAMP WITH TIME ZONE, "approved_by" uuid, "approved_at" TIMESTAMP WITH TIME ZONE, "reopened_by" uuid, "reopened_at" TIMESTAMP WITH TIME ZONE, "reopen_reason" text, "published_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b38ee8a5e607a283b42436ade00" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_a6617e3448c1c7399fac72354c" ON "mark_sheets"  ("org_id") `,
  `CREATE UNIQUE INDEX "uq_mark_sheets" ON "mark_sheets"  ("org_id", "exam_subject_id", "section_id") `,
  `CREATE TABLE "marks" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "mark_sheet_id" uuid NOT NULL, "enrollment_id" uuid NOT NULL, "component_id" uuid NOT NULL, "value" numeric(6,2), "absent" boolean NOT NULL DEFAULT false, "exempt" boolean NOT NULL DEFAULT false, "updated_by" uuid, "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_051deeb008f7449216d568872c6" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_8800d663c156e55bcf9839f3dc" ON "marks"  ("org_id") `,
  `CREATE INDEX "idx_marks_enrollment" ON "marks"  ("org_id", "enrollment_id") `,
  `CREATE UNIQUE INDEX "uq_marks_sheet_enrollment_component" ON "marks"  ("org_id", "mark_sheet_id", "enrollment_id", "component_id") `,
  `CREATE TABLE "result_definitions" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "academic_year_id" uuid NOT NULL, "class_id" uuid NOT NULL, "name" character varying(120) NOT NULL, "items" jsonb NOT NULL, "exam_id" uuid, "computed_at" TIMESTAMP WITH TIME ZONE, "published_at" TIMESTAMP WITH TIME ZONE, "published_by" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_00bceecfd113a12e6d8aac616d3" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_21791508a991079f17f9cf25af" ON "result_definitions"  ("org_id") `,
  `CREATE UNIQUE INDEX "uq_result_definitions_exam" ON "result_definitions"  ("org_id", "exam_id", "class_id") WHERE "exam_id" IS NOT NULL`,
  `CREATE UNIQUE INDEX "uq_result_definitions_name" ON "result_definitions"  ("org_id", "academic_year_id", "class_id", "name") `,
  `CREATE TABLE "results" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "result_definition_id" uuid NOT NULL, "enrollment_id" uuid NOT NULL, "section_id" uuid NOT NULL, "total" numeric(8,2) NOT NULL, "full_marks" numeric(8,2) NOT NULL, "percentage" numeric(5,2) NOT NULL, "gpa" numeric(4,2), "gpa_without_fourth" numeric(4,2), "grade" character varying(40) NOT NULL, "passed" boolean NOT NULL, "failed_count" integer NOT NULL, "grace_used" numeric(6,2) NOT NULL, "position_section" integer, "position_class" integer, "remarks" text, "remarks_by" uuid, "report_card_file_id" uuid, "computed_at" TIMESTAMP WITH TIME ZONE NOT NULL, "published_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_e8f2a9191c61c15b627c117a678" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_82bf6b7e85fdb8170238887996" ON "results"  ("org_id") `,
  `CREATE INDEX "idx_results_enrollment" ON "results"  ("org_id", "enrollment_id") `,
  `CREATE UNIQUE INDEX "uq_results_definition_enrollment" ON "results"  ("org_id", "result_definition_id", "enrollment_id") `,
  `CREATE TABLE "result_subjects" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "result_id" uuid NOT NULL, "class_subject_id" uuid NOT NULL, "marks" numeric(7,2) NOT NULL, "full_marks" numeric(7,2) NOT NULL, "percentage" numeric(5,2) NOT NULL, "grade" character varying(24), "point" numeric(4,2), "passed" boolean NOT NULL, "absent" boolean NOT NULL DEFAULT false, "exempt" boolean NOT NULL DEFAULT false, "is_fourth" boolean NOT NULL DEFAULT false, "grace" numeric(6,2) NOT NULL DEFAULT '0', "components" jsonb NOT NULL, CONSTRAINT "PK_02e5808ffde672dff10202162d8" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_ee75d79409d1ee43df67c90e77" ON "result_subjects"  ("org_id") `,
  `CREATE UNIQUE INDEX "uq_result_subjects" ON "result_subjects"  ("org_id", "result_id", "class_subject_id") `,
  `CREATE TABLE "grade_scale_items" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "grading_system_id" uuid NOT NULL, "letter" character varying(24) NOT NULL, "min_percent" numeric(5,2) NOT NULL, "max_percent" numeric(5,2) NOT NULL, "point" numeric(4,2) NOT NULL, "is_fail" boolean NOT NULL DEFAULT false, "sort_order" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_e3b046f9d2ff9de27a910bbf668" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_b7200afb4843eebec128d923ba" ON "grade_scale_items"  ("org_id") `,
  `CREATE UNIQUE INDEX "uq_grade_scale_items_letter" ON "grade_scale_items"  ("org_id", "grading_system_id", "letter") `,
  `CREATE TABLE "grading_systems" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(80) NOT NULL, "kind" character varying(16) NOT NULL, "rules" jsonb NOT NULL, "template_code" character varying(40), "is_default" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b5c08039cdd918de98652c19eb4" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_5645413e068d4d4a5a41d6a64c" ON "grading_systems"  ("org_id") `,
  `CREATE UNIQUE INDEX "uq_grading_systems_default" ON "grading_systems"  ("org_id") WHERE "is_default"`,
  `CREATE UNIQUE INDEX "uq_grading_systems_org_name" ON "grading_systems"  ("org_id", "name") `,
  `CREATE TABLE "class_grading" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "academic_year_id" uuid NOT NULL, "class_id" uuid NOT NULL, "grading_system_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_49dcf90331911a44697d66d20e3" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_8e9f1f967ab6f05d5830ad703f" ON "class_grading"  ("org_id") `,
  `CREATE UNIQUE INDEX "uq_class_grading" ON "class_grading"  ("org_id", "academic_year_id", "class_id") `,
];

const ALTERS = [
  `ALTER TABLE "imports" ADD "mark_sheet_id" uuid`,
  `ALTER TABLE "exam_types" ADD CONSTRAINT "FK_ea55e5977ccdf1c0fac62a1d500" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "exams" ADD CONSTRAINT "FK_ebfe87241e3c3446a772f87d0b7" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "exams" ADD CONSTRAINT "FK_b97467bb97e3b5afc87bca8e18b" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "exams" ADD CONSTRAINT "FK_a09e73ec2b5b6628ae05af5bedb" FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
  `ALTER TABLE "exams" ADD CONSTRAINT "FK_4841f48d40b53990c8bdb75c7e5" FOREIGN KEY ("exam_type_id") REFERENCES "exam_types"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
  `ALTER TABLE "exam_subjects" ADD CONSTRAINT "FK_d74e2f971eea66306e9e575731e" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "exam_subjects" ADD CONSTRAINT "FK_3890e28948d637c64735bdbf777" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "exam_subjects" ADD CONSTRAINT "FK_a9444692b2898f9ad1b521ec92d" FOREIGN KEY ("class_subject_id") REFERENCES "class_subjects"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
  `ALTER TABLE "exam_subject_components" ADD CONSTRAINT "FK_2ad1fd7f9a8c642a7d37da49820" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "exam_subject_components" ADD CONSTRAINT "FK_798e2336147b8f63356b1ea4a90" FOREIGN KEY ("exam_subject_id") REFERENCES "exam_subjects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "mark_sheets" ADD CONSTRAINT "FK_a6617e3448c1c7399fac72354c3" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "mark_sheets" ADD CONSTRAINT "FK_f3b253d70704ed3ca66afbeab17" FOREIGN KEY ("exam_subject_id") REFERENCES "exam_subjects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "mark_sheets" ADD CONSTRAINT "FK_803b9e62c56ff67db5e054c06d3" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
  `ALTER TABLE "marks" ADD CONSTRAINT "FK_8800d663c156e55bcf9839f3dcc" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "marks" ADD CONSTRAINT "FK_e9915d8b2366a849649a525237d" FOREIGN KEY ("mark_sheet_id") REFERENCES "mark_sheets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "marks" ADD CONSTRAINT "FK_50007770112604d44ca4c6f2a50" FOREIGN KEY ("enrollment_id") REFERENCES "student_enrollments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
  `ALTER TABLE "marks" ADD CONSTRAINT "FK_c272b50d983dce57f9bde89e7c1" FOREIGN KEY ("component_id") REFERENCES "exam_subject_components"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
  `ALTER TABLE "result_definitions" ADD CONSTRAINT "FK_21791508a991079f17f9cf25af2" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "result_definitions" ADD CONSTRAINT "FK_6f28bad58f95796952882ddf8ae" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "result_definitions" ADD CONSTRAINT "FK_8a5302791fff687b36da303d970" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "result_definitions" ADD CONSTRAINT "FK_f045bc69586efa17024f02821a6" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "results" ADD CONSTRAINT "FK_82bf6b7e85fdb81702388879965" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "results" ADD CONSTRAINT "FK_36c8306b45c7ac9dd41a086a83c" FOREIGN KEY ("result_definition_id") REFERENCES "result_definitions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "results" ADD CONSTRAINT "FK_88148799a5da16dc8d382b36889" FOREIGN KEY ("enrollment_id") REFERENCES "student_enrollments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "result_subjects" ADD CONSTRAINT "FK_ee75d79409d1ee43df67c90e779" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "result_subjects" ADD CONSTRAINT "FK_9eee5892e395055f23fbd9d90ea" FOREIGN KEY ("result_id") REFERENCES "results"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "result_subjects" ADD CONSTRAINT "FK_80dd273cd126bf07ba9fcb16708" FOREIGN KEY ("class_subject_id") REFERENCES "class_subjects"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
  `ALTER TABLE "grade_scale_items" ADD CONSTRAINT "FK_b7200afb4843eebec128d923ba9" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "grade_scale_items" ADD CONSTRAINT "FK_fa346cecf70d9da3d4c852d60cc" FOREIGN KEY ("grading_system_id") REFERENCES "grading_systems"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "grading_systems" ADD CONSTRAINT "FK_5645413e068d4d4a5a41d6a64cb" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "class_grading" ADD CONSTRAINT "FK_8e9f1f967ab6f05d5830ad703ff" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "class_grading" ADD CONSTRAINT "FK_74ee6e02653226635f937cc10d7" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "class_grading" ADD CONSTRAINT "FK_0c9c836556289cc4876e9562dbe" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "class_grading" ADD CONSTRAINT "FK_093971d2ecfe624b0f5b222d9f8" FOREIGN KEY ("grading_system_id") REFERENCES "grading_systems"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
];

const DROP = [
  `ALTER TABLE "class_grading" DROP CONSTRAINT "FK_093971d2ecfe624b0f5b222d9f8"`,
  `ALTER TABLE "class_grading" DROP CONSTRAINT "FK_0c9c836556289cc4876e9562dbe"`,
  `ALTER TABLE "class_grading" DROP CONSTRAINT "FK_74ee6e02653226635f937cc10d7"`,
  `ALTER TABLE "class_grading" DROP CONSTRAINT "FK_8e9f1f967ab6f05d5830ad703ff"`,
  `ALTER TABLE "grading_systems" DROP CONSTRAINT "FK_5645413e068d4d4a5a41d6a64cb"`,
  `ALTER TABLE "grade_scale_items" DROP CONSTRAINT "FK_fa346cecf70d9da3d4c852d60cc"`,
  `ALTER TABLE "grade_scale_items" DROP CONSTRAINT "FK_b7200afb4843eebec128d923ba9"`,
  `ALTER TABLE "result_subjects" DROP CONSTRAINT "FK_80dd273cd126bf07ba9fcb16708"`,
  `ALTER TABLE "result_subjects" DROP CONSTRAINT "FK_9eee5892e395055f23fbd9d90ea"`,
  `ALTER TABLE "result_subjects" DROP CONSTRAINT "FK_ee75d79409d1ee43df67c90e779"`,
  `ALTER TABLE "results" DROP CONSTRAINT "FK_88148799a5da16dc8d382b36889"`,
  `ALTER TABLE "results" DROP CONSTRAINT "FK_36c8306b45c7ac9dd41a086a83c"`,
  `ALTER TABLE "results" DROP CONSTRAINT "FK_82bf6b7e85fdb81702388879965"`,
  `ALTER TABLE "result_definitions" DROP CONSTRAINT "FK_f045bc69586efa17024f02821a6"`,
  `ALTER TABLE "result_definitions" DROP CONSTRAINT "FK_8a5302791fff687b36da303d970"`,
  `ALTER TABLE "result_definitions" DROP CONSTRAINT "FK_6f28bad58f95796952882ddf8ae"`,
  `ALTER TABLE "result_definitions" DROP CONSTRAINT "FK_21791508a991079f17f9cf25af2"`,
  `ALTER TABLE "marks" DROP CONSTRAINT "FK_c272b50d983dce57f9bde89e7c1"`,
  `ALTER TABLE "marks" DROP CONSTRAINT "FK_50007770112604d44ca4c6f2a50"`,
  `ALTER TABLE "marks" DROP CONSTRAINT "FK_e9915d8b2366a849649a525237d"`,
  `ALTER TABLE "marks" DROP CONSTRAINT "FK_8800d663c156e55bcf9839f3dcc"`,
  `ALTER TABLE "mark_sheets" DROP CONSTRAINT "FK_803b9e62c56ff67db5e054c06d3"`,
  `ALTER TABLE "mark_sheets" DROP CONSTRAINT "FK_f3b253d70704ed3ca66afbeab17"`,
  `ALTER TABLE "mark_sheets" DROP CONSTRAINT "FK_a6617e3448c1c7399fac72354c3"`,
  `ALTER TABLE "exam_subject_components" DROP CONSTRAINT "FK_798e2336147b8f63356b1ea4a90"`,
  `ALTER TABLE "exam_subject_components" DROP CONSTRAINT "FK_2ad1fd7f9a8c642a7d37da49820"`,
  `ALTER TABLE "exam_subjects" DROP CONSTRAINT "FK_a9444692b2898f9ad1b521ec92d"`,
  `ALTER TABLE "exam_subjects" DROP CONSTRAINT "FK_3890e28948d637c64735bdbf777"`,
  `ALTER TABLE "exam_subjects" DROP CONSTRAINT "FK_d74e2f971eea66306e9e575731e"`,
  `ALTER TABLE "exams" DROP CONSTRAINT "FK_4841f48d40b53990c8bdb75c7e5"`,
  `ALTER TABLE "exams" DROP CONSTRAINT "FK_a09e73ec2b5b6628ae05af5bedb"`,
  `ALTER TABLE "exams" DROP CONSTRAINT "FK_b97467bb97e3b5afc87bca8e18b"`,
  `ALTER TABLE "exams" DROP CONSTRAINT "FK_ebfe87241e3c3446a772f87d0b7"`,
  `ALTER TABLE "exam_types" DROP CONSTRAINT "FK_ea55e5977ccdf1c0fac62a1d500"`,
  `ALTER TABLE "imports" DROP COLUMN "mark_sheet_id"`,
  `DROP INDEX "public"."uq_class_grading"`,
  `DROP INDEX "public"."IDX_8e9f1f967ab6f05d5830ad703f"`,
  `DROP TABLE "class_grading"`,
  `DROP INDEX "public"."uq_grading_systems_org_name"`,
  `DROP INDEX "public"."uq_grading_systems_default"`,
  `DROP INDEX "public"."IDX_5645413e068d4d4a5a41d6a64c"`,
  `DROP TABLE "grading_systems"`,
  `DROP INDEX "public"."uq_grade_scale_items_letter"`,
  `DROP INDEX "public"."IDX_b7200afb4843eebec128d923ba"`,
  `DROP TABLE "grade_scale_items"`,
  `DROP INDEX "public"."uq_result_subjects"`,
  `DROP INDEX "public"."IDX_ee75d79409d1ee43df67c90e77"`,
  `DROP TABLE "result_subjects"`,
  `DROP INDEX "public"."uq_results_definition_enrollment"`,
  `DROP INDEX "public"."idx_results_enrollment"`,
  `DROP INDEX "public"."IDX_82bf6b7e85fdb8170238887996"`,
  `DROP TABLE "results"`,
  `DROP INDEX "public"."uq_result_definitions_name"`,
  `DROP INDEX "public"."uq_result_definitions_exam"`,
  `DROP INDEX "public"."IDX_21791508a991079f17f9cf25af"`,
  `DROP TABLE "result_definitions"`,
  `DROP INDEX "public"."uq_marks_sheet_enrollment_component"`,
  `DROP INDEX "public"."idx_marks_enrollment"`,
  `DROP INDEX "public"."IDX_8800d663c156e55bcf9839f3dc"`,
  `DROP TABLE "marks"`,
  `DROP INDEX "public"."uq_mark_sheets"`,
  `DROP INDEX "public"."IDX_a6617e3448c1c7399fac72354c"`,
  `DROP TABLE "mark_sheets"`,
  `DROP INDEX "public"."uq_exam_subject_components"`,
  `DROP INDEX "public"."IDX_2ad1fd7f9a8c642a7d37da4982"`,
  `DROP TABLE "exam_subject_components"`,
  `DROP INDEX "public"."uq_exam_subjects"`,
  `DROP INDEX "public"."idx_exam_subjects_class"`,
  `DROP INDEX "public"."IDX_d74e2f971eea66306e9e575731"`,
  `DROP TABLE "exam_subjects"`,
  `DROP INDEX "public"."uq_exams_org_year_name"`,
  `DROP INDEX "public"."IDX_ebfe87241e3c3446a772f87d0b"`,
  `DROP TABLE "exams"`,
  `DROP INDEX "public"."uq_exam_types_org_name"`,
  `DROP INDEX "public"."IDX_ea55e5977ccdf1c0fac62a1d50"`,
  `DROP TABLE "exam_types"`,
];

export class ExamsAndResults1792380000000 implements MigrationInterface {
  name = 'ExamsAndResults1792380000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of CREATE_TABLES) await queryRunner.query(sql);
    for (const sql of ALTERS) await queryRunner.query(sql);

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
        'ExamsAndResults: DB_APP_USERNAME is not set, skipping grants.',
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
