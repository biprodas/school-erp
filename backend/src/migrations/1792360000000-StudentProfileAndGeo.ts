import { MigrationInterface, QueryRunner } from 'typeorm';
import { normalizePhone } from '../common/identity/identifier';
import { encryptField } from '../shared/crypto/field-encryption';
import {
  BD_DISTRICTS,
  BD_DIVISIONS,
  BD_UPAZILAS,
} from '../shared/geo/bd-geo.data';

/**
 * M3, student information system (backend plan 7):
 *
 * - Platform `geo_divisions` / `geo_districts` / `geo_upazilas`, filled
 *   from `shared/geo/bd-geo.data` (no RLS: same for every school);
 *   student addresses reference them.
 * - Students: Bangla name, birth registration, blood group (moved from the
 *   medical record), previous school, RFID card, `photo_file_id` (the old
 *   `photo_url` text is dropped), statuses `suspended` / `left` /
 *   `dropped_out` (`inactive` → `left`), `student_status_history`, and
 *   `pg_trgm` name search indexes. Phones are normalized.
 * - Guardians: Bangla name, occupation, income, NID (encrypted), phones
 *   normalized and unique per school (a later duplicate loses its phone,
 *   with a warning; a phone that isn't a valid number is cleared).
 * - Enrollment transfers (`enrollment_changes`); promotion batches replace
 *   `student_promotions`, whose rows move into committed legacy batches.
 * - Documents get `file_id` and a verification status (`verified` →
 *   `verified`; the old `file_url` is dropped). Medical text fields are
 *   encrypted in place (needs `FIELD_ENCRYPTION_KEY` when rows exist), plus
 *   `medications` and `vaccinations`.
 * - `certificates`, `imports`; RLS and app-role grants on every new
 *   org-scoped table; the new permission keys on system roles (frozen copy).
 *
 * `down` is best-effort, for dev databases: new data (certificates,
 * imports, history) is dropped, and encrypted medical text stays encrypted.
 */
const ORG_EXPR = `NULLIF(current_setting('app.org_id', true), '')::uuid`;

const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;

function appRole(): string | null {
  const name = process.env.DB_APP_USERNAME?.trim();
  return name ? quoteIdent(name) : null;
}

const NEW_ORG_TABLES = [
  'certificates',
  'enrollment_changes',
  'imports',
  'promotion_batches',
  'promotion_batch_items',
  'student_status_history',
];

const MEDICAL_TEXT = [
  'allergies',
  'medical_conditions',
  'disabilities',
  'doctor_name',
  'doctor_phone',
  'insurance_info',
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

/** Keys added to each system role (frozen at this migration). */
const ROLE_KEYS: Record<string, string[]> = {
  admin: [
    'students:import',
    'students:export',
    'id_cards:print',
    'student_notes:read_sensitive',
    'certificates:read',
    'certificates:issue',
    'certificates:revoke',
    'employees:import',
    'enrollments:override_capacity',
    'promotions:commit',
  ],
  principal: [
    'student_notes:read_sensitive',
    'students:import',
    'students:export',
    'id_cards:print',
    'certificates:read',
    'certificates:issue',
    'certificates:revoke',
    'enrollments:override_capacity',
    'promotions:commit',
  ],
  receptionist: [
    'students:import',
    'id_cards:print',
    'certificates:read',
    'certificates:issue',
  ],
};

const TRGM = [
  `CREATE EXTENSION IF NOT EXISTS pg_trgm`,
  `CREATE INDEX IF NOT EXISTS "idx_students_name_trgm" ON "students" USING gin ((lower("first_name" || coalesce(' ' || "middle_name", '') || ' ' || "last_name")) gin_trgm_ops)`,
  `CREATE INDEX IF NOT EXISTS "idx_students_name_bn_trgm" ON "students" USING gin ((coalesce("name_bn", '')) gin_trgm_ops)`,
];

const CREATE_TABLES = [
  `CREATE TABLE "geo_divisions" ("id" integer NOT NULL, "name" character varying(80) NOT NULL, "name_bn" character varying(80) NOT NULL, CONSTRAINT "PK_4448cf6cc0d461d070f9ce5552f" PRIMARY KEY ("id"))`,
  `CREATE TABLE "geo_districts" ("id" integer NOT NULL, "division_id" integer NOT NULL, "name" character varying(80) NOT NULL, "name_bn" character varying(80) NOT NULL, CONSTRAINT "PK_ba73ad56ed2790fea574ae8a3fc" PRIMARY KEY ("id"))`,
  `CREATE INDEX "idx_geo_districts_division" ON "geo_districts"  ("division_id") `,
  `CREATE TABLE "geo_upazilas" ("id" integer NOT NULL, "district_id" integer NOT NULL, "name" character varying(80) NOT NULL, "name_bn" character varying(80) NOT NULL, CONSTRAINT "PK_50a853f9eab0b7f7d8ffd36dd77" PRIMARY KEY ("id"))`,
  `CREATE INDEX "idx_geo_upazilas_district" ON "geo_upazilas"  ("district_id") `,
  `CREATE TABLE "certificates" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "student_id" uuid NOT NULL, "type" character varying(16) NOT NULL, "serial" character varying(60) NOT NULL, "issued_at" TIMESTAMP WITH TIME ZONE NOT NULL, "issued_by" uuid, "data" jsonb NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'valid', "revoke_reason" text, "revoked_at" TIMESTAMP WITH TIME ZONE, "revoked_by" uuid, "verify_token" character varying(64) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e4c7e31e2144300bea7d89eb165" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_a4690fe5cc48f9ea9db0a53948" ON "certificates"  ("org_id") `,
  `CREATE INDEX "idx_certificates_student" ON "certificates"  ("org_id", "student_id") `,
  `CREATE UNIQUE INDEX "uq_certificates_verify_token" ON "certificates"  ("verify_token") `,
  `CREATE UNIQUE INDEX "uq_certificates_org_serial" ON "certificates"  ("org_id", "serial") `,
  `CREATE TABLE "enrollment_changes" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "enrollment_id" uuid NOT NULL, "from_section_id" uuid NOT NULL, "to_section_id" uuid NOT NULL, "from_roll_no" character varying(40), "reason" text, "effective_date" date NOT NULL, "changed_by" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1149e77c7792923f6b0de8e3419" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_d299453447f800915ee935f595" ON "enrollment_changes"  ("org_id") `,
  `CREATE INDEX "idx_enrollment_changes_enrollment" ON "enrollment_changes"  ("org_id", "enrollment_id") `,
  `CREATE TABLE "imports" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" character varying(16) NOT NULL, "file_id" uuid, "status" character varying(16) NOT NULL DEFAULT 'uploaded', "mode" character varying(16) NOT NULL DEFAULT 'all_or_nothing', "academic_year_id" uuid, "totals" jsonb, "errors" jsonb NOT NULL DEFAULT '[]', "rows" jsonb NOT NULL DEFAULT '[]', "failure" text, "created_by" uuid, "committed_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ea10c62f5eb1d75e83d8b5225db" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_ece7af0a9bdf5d7aabd4e82fce" ON "imports"  ("org_id") `,
  `CREATE INDEX "idx_imports_org_created" ON "imports"  ("org_id", "created_at") `,
  `CREATE TABLE "promotion_batches" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "from_year_id" uuid NOT NULL, "to_year_id" uuid NOT NULL, "class_id" uuid NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'draft', "options" jsonb NOT NULL, "created_by" uuid, "committed_at" TIMESTAMP WITH TIME ZONE, "committed_by" uuid, "rolled_back_at" TIMESTAMP WITH TIME ZONE, "rolled_back_by" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_070d8b1f206ab9f439b4fb4e4a0" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_c5ec0af9a279d485f2ac98d1e8" ON "promotion_batches"  ("org_id") `,
  `CREATE UNIQUE INDEX "uq_promotion_batches_live" ON "promotion_batches"  ("org_id", "from_year_id", "class_id") WHERE "status" IN ('draft', 'committed')`,
  `CREATE TABLE "promotion_batch_items" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "batch_id" uuid NOT NULL, "student_id" uuid NOT NULL, "enrollment_id" uuid, "outcome" character varying(16) NOT NULL, "to_class_id" uuid, "to_section_id" uuid, "new_roll" character varying(40), "overridden" boolean NOT NULL DEFAULT false, "note" text, "new_enrollment_id" uuid, "previous_status" character varying(16), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e75ca2f2e82dd0e6cc94ab21e6d" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_b6b8eb529865498464fdbc3f10" ON "promotion_batch_items"  ("org_id") `,
  `CREATE UNIQUE INDEX "uq_promotion_batch_items_student" ON "promotion_batch_items"  ("org_id", "batch_id", "student_id") `,
  `CREATE TABLE "student_status_history" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "student_id" uuid NOT NULL, "from_status" character varying(16) NOT NULL, "to_status" character varying(16) NOT NULL, "reason" text, "effective_date" date NOT NULL, "changed_by" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9caaa098d58985adb77f7d85917" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_46ad1535e72af857eed2dbc7b7" ON "student_status_history"  ("org_id") `,
  `CREATE INDEX "idx_student_status_history_student" ON "student_status_history"  ("org_id", "student_id") `,
];

const ADD_COLUMNS = [
  `ALTER TABLE "guardians" ADD "name_bn" character varying(160)`,
  `ALTER TABLE "guardians" ADD "occupation" character varying(120)`,
  `ALTER TABLE "guardians" ADD "income" bigint`,
  `ALTER TABLE "guardians" ADD "nid" text`,
  `ALTER TABLE "student_addresses" ADD "division_id" integer`,
  `ALTER TABLE "student_addresses" ADD "district_id" integer`,
  `ALTER TABLE "student_addresses" ADD "upazila_id" integer`,
  `ALTER TABLE "student_documents" ADD "file_id" uuid`,
  `ALTER TABLE "student_documents" ADD "verification_status" character varying(16) NOT NULL DEFAULT 'pending'`,
  `ALTER TABLE "student_documents" ADD "verified_by" uuid`,
  `ALTER TABLE "student_documents" ADD "verified_at" TIMESTAMP WITH TIME ZONE`,
  `ALTER TABLE "student_documents" ADD "verification_note" text`,
  `ALTER TABLE "student_medical_records" ADD "medications" text`,
  `ALTER TABLE "student_medical_records" ADD "vaccinations" text`,
  `ALTER TABLE "students" ADD "name_bn" character varying(160)`,
  `ALTER TABLE "students" ADD "birth_reg_no" character varying(32)`,
  `ALTER TABLE "students" ADD "blood_group" character varying(4)`,
  `ALTER TABLE "students" ADD "previous_school" character varying(200)`,
  `ALTER TABLE "students" ADD "rfid_card_no" character varying(40)`,
  `ALTER TABLE "students" ADD "photo_file_id" uuid`,
];

const DROP_COLUMNS = [
  `ALTER TABLE "student_documents" DROP COLUMN "verified"`,
  `ALTER TABLE "student_documents" DROP COLUMN "file_url"`,
  `ALTER TABLE "student_medical_records" DROP COLUMN "blood_group"`,
  `ALTER TABLE "students" DROP COLUMN "photo_url"`,
];

const UNIQUE_INDEXES = [
  `CREATE UNIQUE INDEX "uq_guardians_org_phone" ON "guardians"  ("org_id", "phone") WHERE "phone" IS NOT NULL AND "deleted_at" IS NULL`,
  `CREATE UNIQUE INDEX "uq_students_org_rfid" ON "students"  ("org_id", "rfid_card_no") WHERE "rfid_card_no" IS NOT NULL AND "deleted_at" IS NULL`,
];

const FOREIGN_KEYS = [
  `ALTER TABLE "geo_districts" ADD CONSTRAINT "FK_35245a29b401057b4b1850abc1e" FOREIGN KEY ("division_id") REFERENCES "geo_divisions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "geo_upazilas" ADD CONSTRAINT "FK_f7b4e2fe6e9a67eb63f59fdc2b7" FOREIGN KEY ("district_id") REFERENCES "geo_districts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "student_addresses" ADD CONSTRAINT "FK_7b462245a97841df446e2b129e2" FOREIGN KEY ("division_id") REFERENCES "geo_divisions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
  `ALTER TABLE "student_addresses" ADD CONSTRAINT "FK_ef65d9dcab9ed92afe7d8cdb168" FOREIGN KEY ("district_id") REFERENCES "geo_districts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
  `ALTER TABLE "student_addresses" ADD CONSTRAINT "FK_e7dfb740b8d5e5a38fc672a6ddb" FOREIGN KEY ("upazila_id") REFERENCES "geo_upazilas"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
  `ALTER TABLE "student_documents" ADD CONSTRAINT "FK_2ec8a64f240f059cae18c178dcc" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
  `ALTER TABLE "students" ADD CONSTRAINT "FK_f0a14e33b56d6d864aae759c90e" FOREIGN KEY ("photo_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
  `ALTER TABLE "certificates" ADD CONSTRAINT "FK_a4690fe5cc48f9ea9db0a539486" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "certificates" ADD CONSTRAINT "FK_5fc025803a5eb21001b77ed6b1a" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "enrollment_changes" ADD CONSTRAINT "FK_d299453447f800915ee935f5954" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "enrollment_changes" ADD CONSTRAINT "FK_f5aacee5c1698139abd5b4c0987" FOREIGN KEY ("enrollment_id") REFERENCES "student_enrollments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "enrollment_changes" ADD CONSTRAINT "FK_011a5a391fd486de285d74882bb" FOREIGN KEY ("from_section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "enrollment_changes" ADD CONSTRAINT "FK_9774cdced01fc731754831de35b" FOREIGN KEY ("to_section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "imports" ADD CONSTRAINT "FK_ece7af0a9bdf5d7aabd4e82fceb" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "imports" ADD CONSTRAINT "FK_1a23b2a85cf45edc6198ad04162" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
  `ALTER TABLE "promotion_batches" ADD CONSTRAINT "FK_c5ec0af9a279d485f2ac98d1e87" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "promotion_batches" ADD CONSTRAINT "FK_caf83f70e418ad33d578b05d8f6" FOREIGN KEY ("from_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "promotion_batches" ADD CONSTRAINT "FK_67b2ca2fbb5828e7824e949f6b2" FOREIGN KEY ("to_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "promotion_batches" ADD CONSTRAINT "FK_6651e2d36b62f69a7d424fa80dc" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "promotion_batch_items" ADD CONSTRAINT "FK_b6b8eb529865498464fdbc3f10a" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "promotion_batch_items" ADD CONSTRAINT "FK_9002ac578d7b671573dac922fb1" FOREIGN KEY ("batch_id") REFERENCES "promotion_batches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "promotion_batch_items" ADD CONSTRAINT "FK_1ca03d7b47992fd39fc395d1341" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "promotion_batch_items" ADD CONSTRAINT "FK_3a08cde892242d2cad0e780eb9d" FOREIGN KEY ("enrollment_id") REFERENCES "student_enrollments"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
  `ALTER TABLE "promotion_batch_items" ADD CONSTRAINT "FK_701ae00ab555caad13cdad860bc" FOREIGN KEY ("to_class_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
  `ALTER TABLE "promotion_batch_items" ADD CONSTRAINT "FK_a4769d6d2bfc68c42e658b18d55" FOREIGN KEY ("to_section_id") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
  `ALTER TABLE "student_status_history" ADD CONSTRAINT "FK_46ad1535e72af857eed2dbc7b7b" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "student_status_history" ADD CONSTRAINT "FK_6701922ff27ac32e35f6b05fa48" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
];

const DOWN = [
  `ALTER TABLE "student_status_history" DROP CONSTRAINT "FK_6701922ff27ac32e35f6b05fa48"`,
  `ALTER TABLE "student_status_history" DROP CONSTRAINT "FK_46ad1535e72af857eed2dbc7b7b"`,
  `ALTER TABLE "promotion_batch_items" DROP CONSTRAINT "FK_a4769d6d2bfc68c42e658b18d55"`,
  `ALTER TABLE "promotion_batch_items" DROP CONSTRAINT "FK_701ae00ab555caad13cdad860bc"`,
  `ALTER TABLE "promotion_batch_items" DROP CONSTRAINT "FK_3a08cde892242d2cad0e780eb9d"`,
  `ALTER TABLE "promotion_batch_items" DROP CONSTRAINT "FK_1ca03d7b47992fd39fc395d1341"`,
  `ALTER TABLE "promotion_batch_items" DROP CONSTRAINT "FK_9002ac578d7b671573dac922fb1"`,
  `ALTER TABLE "promotion_batch_items" DROP CONSTRAINT "FK_b6b8eb529865498464fdbc3f10a"`,
  `ALTER TABLE "promotion_batches" DROP CONSTRAINT "FK_6651e2d36b62f69a7d424fa80dc"`,
  `ALTER TABLE "promotion_batches" DROP CONSTRAINT "FK_67b2ca2fbb5828e7824e949f6b2"`,
  `ALTER TABLE "promotion_batches" DROP CONSTRAINT "FK_caf83f70e418ad33d578b05d8f6"`,
  `ALTER TABLE "promotion_batches" DROP CONSTRAINT "FK_c5ec0af9a279d485f2ac98d1e87"`,
  `ALTER TABLE "imports" DROP CONSTRAINT "FK_1a23b2a85cf45edc6198ad04162"`,
  `ALTER TABLE "imports" DROP CONSTRAINT "FK_ece7af0a9bdf5d7aabd4e82fceb"`,
  `ALTER TABLE "enrollment_changes" DROP CONSTRAINT "FK_9774cdced01fc731754831de35b"`,
  `ALTER TABLE "enrollment_changes" DROP CONSTRAINT "FK_011a5a391fd486de285d74882bb"`,
  `ALTER TABLE "enrollment_changes" DROP CONSTRAINT "FK_f5aacee5c1698139abd5b4c0987"`,
  `ALTER TABLE "enrollment_changes" DROP CONSTRAINT "FK_d299453447f800915ee935f5954"`,
  `ALTER TABLE "certificates" DROP CONSTRAINT "FK_5fc025803a5eb21001b77ed6b1a"`,
  `ALTER TABLE "certificates" DROP CONSTRAINT "FK_a4690fe5cc48f9ea9db0a539486"`,
  `ALTER TABLE "students" DROP CONSTRAINT "FK_f0a14e33b56d6d864aae759c90e"`,
  `ALTER TABLE "student_documents" DROP CONSTRAINT "FK_2ec8a64f240f059cae18c178dcc"`,
  `ALTER TABLE "student_addresses" DROP CONSTRAINT "FK_e7dfb740b8d5e5a38fc672a6ddb"`,
  `ALTER TABLE "student_addresses" DROP CONSTRAINT "FK_ef65d9dcab9ed92afe7d8cdb168"`,
  `ALTER TABLE "student_addresses" DROP CONSTRAINT "FK_7b462245a97841df446e2b129e2"`,
  `ALTER TABLE "geo_upazilas" DROP CONSTRAINT "FK_f7b4e2fe6e9a67eb63f59fdc2b7"`,
  `ALTER TABLE "geo_districts" DROP CONSTRAINT "FK_35245a29b401057b4b1850abc1e"`,
  `DROP INDEX "public"."uq_students_org_rfid"`,
  `DROP INDEX "public"."uq_guardians_org_phone"`,
  `ALTER TABLE "students" DROP COLUMN "photo_file_id"`,
  `ALTER TABLE "students" DROP COLUMN "rfid_card_no"`,
  `ALTER TABLE "students" DROP COLUMN "previous_school"`,
  `ALTER TABLE "students" DROP COLUMN "blood_group"`,
  `ALTER TABLE "students" DROP COLUMN "birth_reg_no"`,
  `ALTER TABLE "students" DROP COLUMN "name_bn"`,
  `ALTER TABLE "student_medical_records" DROP COLUMN "vaccinations"`,
  `ALTER TABLE "student_medical_records" DROP COLUMN "medications"`,
  `ALTER TABLE "student_documents" DROP COLUMN "verification_note"`,
  `ALTER TABLE "student_documents" DROP COLUMN "verified_at"`,
  `ALTER TABLE "student_documents" DROP COLUMN "verified_by"`,
  `ALTER TABLE "student_documents" DROP COLUMN "verification_status"`,
  `ALTER TABLE "student_documents" DROP COLUMN "file_id"`,
  `ALTER TABLE "student_addresses" DROP COLUMN "upazila_id"`,
  `ALTER TABLE "student_addresses" DROP COLUMN "district_id"`,
  `ALTER TABLE "student_addresses" DROP COLUMN "division_id"`,
  `ALTER TABLE "guardians" DROP COLUMN "nid"`,
  `ALTER TABLE "guardians" DROP COLUMN "income"`,
  `ALTER TABLE "guardians" DROP COLUMN "occupation"`,
  `ALTER TABLE "guardians" DROP COLUMN "name_bn"`,
  `ALTER TABLE "students" ADD "photo_url" text`,
  `ALTER TABLE "student_medical_records" ADD "blood_group" character varying(8)`,
  // Uploaded files have no URL to go back to: an empty one.
  `ALTER TABLE "student_documents" ADD "file_url" text NOT NULL DEFAULT ''`,
  `ALTER TABLE "student_documents" ALTER COLUMN "file_url" DROP DEFAULT`,
  `ALTER TABLE "student_documents" ADD "verified" boolean NOT NULL DEFAULT false`,
  `DROP INDEX "public"."idx_student_status_history_student"`,
  `DROP INDEX "public"."IDX_46ad1535e72af857eed2dbc7b7"`,
  `DROP TABLE "student_status_history"`,
  `DROP INDEX "public"."uq_promotion_batch_items_student"`,
  `DROP INDEX "public"."IDX_b6b8eb529865498464fdbc3f10"`,
  `DROP TABLE "promotion_batch_items"`,
  `DROP INDEX "public"."uq_promotion_batches_live"`,
  `DROP INDEX "public"."IDX_c5ec0af9a279d485f2ac98d1e8"`,
  `DROP TABLE "promotion_batches"`,
  `DROP INDEX "public"."idx_imports_org_created"`,
  `DROP INDEX "public"."IDX_ece7af0a9bdf5d7aabd4e82fce"`,
  `DROP TABLE "imports"`,
  `DROP INDEX "public"."idx_enrollment_changes_enrollment"`,
  `DROP INDEX "public"."IDX_d299453447f800915ee935f595"`,
  `DROP TABLE "enrollment_changes"`,
  `DROP INDEX "public"."uq_certificates_org_serial"`,
  `DROP INDEX "public"."uq_certificates_verify_token"`,
  `DROP INDEX "public"."idx_certificates_student"`,
  `DROP INDEX "public"."IDX_a4690fe5cc48f9ea9db0a53948"`,
  `DROP TABLE "certificates"`,
  `DROP INDEX "public"."idx_geo_upazilas_district"`,
  `DROP TABLE "geo_upazilas"`,
  `DROP INDEX "public"."idx_geo_districts_division"`,
  `DROP TABLE "geo_districts"`,
  `DROP TABLE "geo_divisions"`,
];

const LEGACY_PROMOTIONS_DDL = [
  `CREATE TABLE "student_promotions" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "student_id" uuid NOT NULL, "from_year_id" uuid NOT NULL, "to_year_id" uuid NOT NULL, "from_class_id" uuid NOT NULL, "to_class_id" uuid NOT NULL, "from_section_id" uuid, "to_section_id" uuid, "promotion_date" date, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b1f7041c5f21cff8bf7947275b7" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_7e4f84216e45570284e9550932" ON "student_promotions" ("org_id") `,
  `ALTER TABLE "student_promotions" ADD CONSTRAINT "FK_7e4f84216e45570284e95509326" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "student_promotions" ADD CONSTRAINT "FK_8b5a02b2d1bd921d1343e0751e1" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "student_promotions" ADD CONSTRAINT "FK_259206ca4cdc48c9a9f6f1a34cb" FOREIGN KEY ("from_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "student_promotions" ADD CONSTRAINT "FK_e2dd6049ef927f0d7d066c748ad" FOREIGN KEY ("to_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "student_promotions" ADD CONSTRAINT "FK_1f6fecc9cb339fdf3baa72106f9" FOREIGN KEY ("from_class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "student_promotions" ADD CONSTRAINT "FK_b897ed65b14f94884075483b73b" FOREIGN KEY ("to_class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "student_promotions" ADD CONSTRAINT "FK_c2954e70327a5cd906e8bdf1fd2" FOREIGN KEY ("from_section_id") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
  `ALTER TABLE "student_promotions" ADD CONSTRAINT "FK_7f87ccae480386041fe16049519" FOREIGN KEY ("to_section_id") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
];

export class StudentProfileAndGeo1792360000000 implements MigrationInterface {
  name = 'StudentProfileAndGeo1792360000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of CREATE_TABLES) await queryRunner.query(sql);
    await this.seedGeo(queryRunner);
    for (const sql of ADD_COLUMNS) await queryRunner.query(sql);
    await queryRunner.query(
      `ALTER TABLE "student_medical_records" ALTER COLUMN "doctor_name" TYPE text, ALTER COLUMN "doctor_phone" TYPE text`,
    );

    // --- Data ------------------------------------------------------------
    await queryRunner.query(
      `UPDATE "students" SET "status" = 'left' WHERE "status" = 'inactive'`,
    );
    await queryRunner.query(
      `UPDATE "students" s SET "blood_group" = upper(trim(m."blood_group"))
       FROM "student_medical_records" m
       WHERE m."student_id" = s."id" AND upper(trim(m."blood_group")) = ANY($1)`,
      [BLOOD_GROUPS],
    );
    await queryRunner.query(
      `UPDATE "student_documents" SET "verification_status" = 'verified' WHERE "verified"`,
    );
    await this.normalizePhones(queryRunner);
    await this.encryptMedical(queryRunner);
    await this.moveLegacyPromotions(queryRunner);

    for (const sql of DROP_COLUMNS) await queryRunner.query(sql);
    for (const sql of UNIQUE_INDEXES) await queryRunner.query(sql);
    for (const sql of FOREIGN_KEYS) await queryRunner.query(sql);
    for (const sql of TRGM) await queryRunner.query(sql);

    // --- RLS, grants, roles ---------------------------------------------
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
    if (role) {
      // Address pickers are read on the tenant connection's joins.
      await queryRunner.query(
        `GRANT SELECT ON public."geo_divisions", public."geo_districts", public."geo_upazilas" TO ${role}`,
      );
    } else {
      console.warn(
        'StudentProfileAndGeo: DB_APP_USERNAME is not set, skipping grants.',
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
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_students_name_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_students_name_bn_trgm"`);

    for (const sql of LEGACY_PROMOTIONS_DDL) await queryRunner.query(sql);
    await queryRunner.query(
      `ALTER TABLE public."student_promotions" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `CREATE POLICY org_isolation ON public."student_promotions" USING (org_id = ${ORG_EXPR}) WITH CHECK (org_id = ${ORG_EXPR})`,
    );
    const role = appRole();
    if (role) {
      await queryRunner.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON public."student_promotions" TO ${role}`,
      );
    }
    await queryRunner.query(`
      INSERT INTO "student_promotions"
        ("org_id", "student_id", "from_year_id", "to_year_id", "from_class_id",
         "to_class_id", "from_section_id", "to_section_id", "promotion_date")
      SELECT i."org_id", i."student_id", b."from_year_id", b."to_year_id",
             b."class_id", coalesce(i."to_class_id", b."class_id"),
             e."section_id", i."to_section_id", b."committed_at"::date
      FROM "promotion_batch_items" i
      JOIN "promotion_batches" b ON b."id" = i."batch_id"
      LEFT JOIN "student_enrollments" e ON e."id" = i."enrollment_id"
      WHERE b."status" = 'committed'`);

    // The generated reverse, minus the medical column types (text stays).
    for (const sql of DOWN) await queryRunner.query(sql);
    await queryRunner.query(
      `UPDATE "students" SET "status" = 'inactive' WHERE "status" IN ('left', 'dropped_out', 'suspended')`,
    );
  }

  private async seedGeo(queryRunner: QueryRunner): Promise<void> {
    for (const [table, parent, rows] of [
      ['geo_divisions', null, BD_DIVISIONS],
      ['geo_districts', 'division_id', BD_DISTRICTS],
      ['geo_upazilas', 'district_id', BD_UPAZILAS],
    ] as const) {
      for (const [id, parentId, name, nameBn] of rows) {
        await queryRunner.query(
          parent
            ? `INSERT INTO "${table}" ("id", "${parent}", "name", "name_bn") VALUES ($1, $2, $3, $4)`
            : `INSERT INTO "${table}" ("id", "name", "name_bn") VALUES ($1, $2, $3)`,
          parent ? [id, parentId, name, nameBn] : [id, name, nameBn],
        );
      }
    }
  }

  /** E.164 phones; a guardian phone used twice in a school stays on the oldest. */
  private async normalizePhones(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['students', 'guardians']) {
      const rows = (await queryRunner.query(
        `SELECT "id", "org_id", "phone" FROM "${table}"
         WHERE "phone" IS NOT NULL ORDER BY "created_at", "id"`,
      )) as { id: string; org_id: string; phone: string }[];
      const seen = new Set<string>();
      for (const row of rows) {
        let phone = normalizePhone(row.phone);
        if (table === 'guardians' && phone) {
          const key = `${row.org_id}:${phone}`;
          if (seen.has(key)) {
            console.warn(
              `StudentProfileAndGeo: guardian ${row.id} shares phone ${phone}; cleared`,
            );
            phone = null;
          } else {
            seen.add(key);
          }
        }
        if (phone !== row.phone) {
          await queryRunner.query(
            `UPDATE "${table}" SET "phone" = $2 WHERE "id" = $1`,
            [row.id, phone],
          );
        }
      }
    }
  }

  /** Encrypts existing medical text (the app now reads it encrypted). */
  private async encryptMedical(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      `SELECT "id", ${MEDICAL_TEXT.map((c) => `"${c}"`).join(', ')}
       FROM "student_medical_records"`,
    )) as Record<string, string | null>[];
    for (const row of rows) {
      const values = MEDICAL_TEXT.map((c) =>
        row[c] === null || row[c].startsWith('v1:')
          ? row[c]
          : encryptField(row[c]),
      );
      await queryRunner.query(
        `UPDATE "student_medical_records" SET ${MEDICAL_TEXT.map(
          (c, i) => `"${c}" = $${i + 2}`,
        ).join(', ')} WHERE "id" = $1`,
        [row.id, ...values],
      );
    }
  }

  /** One committed legacy batch per school, session and class. */
  private async moveLegacyPromotions(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "promotion_batches"
        ("org_id", "from_year_id", "to_year_id", "class_id", "status", "options", "committed_at")
      SELECT "org_id", "from_year_id", (array_agg("to_year_id" ORDER BY "created_at" DESC))[1],
             "from_class_id", 'committed',
             '{"rollBy":"keep","shuffleSections":false,"legacy":true}'::jsonb,
             max("created_at")
      FROM "student_promotions"
      GROUP BY "org_id", "from_year_id", "from_class_id"`);
    await queryRunner.query(`
      INSERT INTO "promotion_batch_items"
        ("org_id", "batch_id", "student_id", "enrollment_id", "outcome",
         "to_class_id", "to_section_id", "note")
      SELECT DISTINCT ON (b."id", p."student_id")
             p."org_id", b."id", p."student_id", e."id", 'promote',
             p."to_class_id", p."to_section_id", NULL
      FROM "student_promotions" p
      JOIN "promotion_batches" b
        ON b."org_id" = p."org_id" AND b."from_year_id" = p."from_year_id"
       AND b."class_id" = p."from_class_id" AND b."options" ->> 'legacy' = 'true'
      LEFT JOIN "student_enrollments" e
        ON e."student_id" = p."student_id" AND e."academic_year_id" = p."from_year_id"
      ORDER BY b."id", p."student_id", p."created_at" DESC`);
    await queryRunner.query(`DROP TABLE "student_promotions"`);
  }
}
