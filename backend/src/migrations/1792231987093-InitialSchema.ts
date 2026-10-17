import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1792231987093 implements MigrationInterface {
  name = 'InitialSchema1792231987093';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // uuid_generate_v4() defaults below need this extension.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TYPE "public"."organizations_status_enum" AS ENUM('pending', 'active', 'inactive', 'suspended', 'archived')`,
    );
    await queryRunner.query(
      `CREATE TABLE "organizations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "slug" character varying NOT NULL, "domain" character varying, "status" "public"."organizations_status_enum" NOT NULL DEFAULT 'active', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_963693341bd612aa01ddf3a4b68" UNIQUE ("slug"), CONSTRAINT "UQ_98678ed828cc71e4f8a58c95d6b" UNIQUE ("domain"), CONSTRAINT "PK_6b031fcd0863e3f6b44230163f9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."memberships_role_enum" AS ENUM('owner', 'admin', 'member')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."memberships_status_enum" AS ENUM('pending', 'active', 'suspended', 'deactivated')`,
    );
    await queryRunner.query(
      `CREATE TABLE "memberships" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "org_id" uuid NOT NULL, "role" "public"."memberships_role_enum" NOT NULL DEFAULT 'member', "is_admin" boolean NOT NULL DEFAULT false, "status" "public"."memberships_status_enum" NOT NULL DEFAULT 'active', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_25d28bd932097a9e90495ede7b4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8c6a511c72951c42e008f5537d" ON "memberships" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_memberships_org_user" ON "memberships" ("org_id", "user_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_platform_role_enum" AS ENUM('super_admin', 'admin', 'support', 'developer', 'user')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_status_enum" AS ENUM('pending', 'active', 'suspended', 'deactivated', 'banned')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "password" character varying NOT NULL, "username" character varying(60), "name" character varying NOT NULL, "platform_role" "public"."users_platform_role_enum" NOT NULL DEFAULT 'user', "status" "public"."users_status_enum" NOT NULL DEFAULT 'active', "is_admin" boolean NOT NULL DEFAULT false, "email_verified_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "periods" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(80) NOT NULL, "start_time" TIME, "end_time" TIME, "display_order" integer NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_86c6afb6c818d97dc321898627c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5cc03bb83c3c37f1327cbe2d3b" ON "periods" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_periods_org_name" ON "periods" ("org_id", "name") `,
    );
    await queryRunner.query(
      `CREATE TABLE "academic_years" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(80) NOT NULL, "code" character varying(40), "start_date" date, "end_date" date, "is_current" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, "description" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "PK_2021b90bfbfa6c9da7df34ca1cf" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9960bb4643f2cad8ca81eaaa35" ON "academic_years" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_academic_years_org_name" ON "academic_years" ("org_id", "name") `,
    );
    await queryRunner.query(
      `CREATE TABLE "sections" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(60) NOT NULL, "code" character varying(40), "description" text, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f9749dd3bffd880a497d007e450" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4ada0895ef0e4e62ae0572437f" ON "sections" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_sections_org_name" ON "sections" ("org_id", "name") `,
    );
    await queryRunner.query(
      `CREATE TABLE "class_sections" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "class_id" uuid NOT NULL, "section_id" uuid NOT NULL, "capacity" integer, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e33e202b8db5a2bb2d6d6f0c3b6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4c23981775ca38c84a93be61dd" ON "class_sections" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_class_section" ON "class_sections" ("org_id", "class_id", "section_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "classes" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "code" character varying(40), "level" integer, "description" text, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e207aa15404e9b2ce35910f9f7f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_46b99667b3ff4c3bc767219314" ON "classes" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_classes_org_name" ON "classes" ("org_id", "name") `,
    );
    await queryRunner.query(
      `CREATE TABLE "departments" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "code" character varying(40), "description" text, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_839517a681a86bb84cbcc6a1e9d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3cfef557719b71f778c7e8ce7a" ON "departments" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_departments_org_name" ON "departments" ("org_id", "name") `,
    );
    await queryRunner.query(
      `CREATE TABLE "designations" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(120) NOT NULL, "description" text, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a0f024b99b1491a03fc421858ea" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_83c50a9e2afff0b83c663f6fe9" ON "designations" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_designations_org_title" ON "designations" ("org_id", "title") `,
    );
    await queryRunner.query(
      `CREATE TABLE "employees" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "employee_number" character varying(60) NOT NULL, "first_name" character varying NOT NULL, "last_name" character varying NOT NULL, "email" character varying, "phone" character varying(40), "gender" character varying(16), "dob" date, "address" text, "joining_date" date, "qualification" character varying(255), "status" character varying NOT NULL DEFAULT 'active', "department_id" uuid, "designation_id" uuid, "user_id" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "PK_b9535a98350d5b26e7eb0c26af4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b75e1cf8e5b4de783e41263b15" ON "employees" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_employees_org_employee_number" ON "employees" ("org_id", "employee_number") `,
    );
    await queryRunner.query(
      `CREATE TABLE "subjects" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "code" character varying(40), "type" character varying(16) NOT NULL DEFAULT 'theory', "is_optional" boolean NOT NULL DEFAULT false, "credit" integer, "description" text, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1a023685ac2b051b4e557b0b280" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fd66a1b32161cdbab76cd0d1d2" ON "subjects" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_subjects_org_code" ON "subjects" ("org_id", "code") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_subjects_org_name" ON "subjects" ("org_id", "name") `,
    );
    await queryRunner.query(
      `CREATE TABLE "class_timetables" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "academic_year_id" uuid NOT NULL, "class_id" uuid NOT NULL, "section_id" uuid NOT NULL, "day_of_week" character varying(12) NOT NULL, "period_id" uuid NOT NULL, "subject_id" uuid NOT NULL, "employee_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_611d7b783eac764dd7edcd0bf8b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0312af1f3cb76cbf3c7a28debc" ON "class_timetables" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_timetable_slot" ON "class_timetables" ("org_id", "academic_year_id", "class_id", "section_id", "day_of_week", "period_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "subject_teachers" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "class_id" uuid NOT NULL, "section_id" uuid NOT NULL, "subject_id" uuid NOT NULL, "employee_id" uuid NOT NULL, "academic_year_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_840ef4bcf19b6c73542e1840d5e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1177103528119c62c988ea8daf" ON "subject_teachers" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_subject_teacher" ON "subject_teachers" ("org_id", "academic_year_id", "class_id", "section_id", "subject_id", "employee_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "class_teachers" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "class_id" uuid NOT NULL, "section_id" uuid NOT NULL, "employee_id" uuid NOT NULL, "academic_year_id" uuid NOT NULL, "is_primary" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_af6f6d3e46a2ac73959f65f3d9a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f61b2b59700e7c47e5b48dc38a" ON "class_teachers" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_class_teacher" ON "class_teachers" ("org_id", "academic_year_id", "class_id", "section_id", "employee_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."tasks_status_enum" AS ENUM('todo', 'in_progress', 'done')`,
    );
    await queryRunner.query(
      `CREATE TABLE "tasks" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(200) NOT NULL, "description" text, "status" "public"."tasks_status_enum" NOT NULL DEFAULT 'todo', "due_date" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8d12ff38fcc62aaba2cab748772" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6a7a4f687b74075698d59c172b" ON "tasks" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "subject_group_subjects" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "subject_group_id" uuid NOT NULL, "subject_id" uuid NOT NULL, "is_compulsory" boolean NOT NULL DEFAULT true, "display_order" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_92b27ea8170161720a0b3bcaad6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f27a281a1762c469983af9cee3" ON "subject_group_subjects" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_subject_group_subject" ON "subject_group_subjects" ("org_id", "subject_group_id", "subject_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "subject_groups" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "code" character varying(40), "description" text, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3a35e218586353e083653ac4c22" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8240b25a97cbefb880bc14ce5e" ON "subject_groups" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_subject_groups_org_name" ON "subject_groups" ("org_id", "name") `,
    );
    await queryRunner.query(
      `CREATE TABLE "guardians" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "phone" character varying(40), "email" character varying, "address" text, "user_id" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "PK_3dcf02f3dc96a2c017106f280be" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a90286ac6c753390841d89d376" ON "guardians" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "student_guardians" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "student_id" uuid NOT NULL, "guardian_id" uuid NOT NULL, "relation" character varying(16) NOT NULL, "is_primary" boolean NOT NULL DEFAULT false, "is_emergency" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_11ef78f5131711d8da1b14e3332" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c2ed4b1ac1a1c3fda1748f9986" ON "student_guardians" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_student_guardian" ON "student_guardians" ("org_id", "student_id", "guardian_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "student_addresses" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "student_id" uuid NOT NULL, "address_type" character varying(16) NOT NULL, "address_line_1" character varying(255) NOT NULL, "address_line_2" character varying(255), "city" character varying(120), "district" character varying(120), "state" character varying(120), "postal_code" character varying(20), "country" character varying(120), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_08aa34f25a7e16779611904ba55" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_002a60c49e7e8ccd7effe87710" ON "student_addresses" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_student_address_type" ON "student_addresses" ("org_id", "student_id", "address_type") `,
    );
    await queryRunner.query(
      `CREATE TABLE "student_documents" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "student_id" uuid NOT NULL, "document_type" character varying(32) NOT NULL, "title" character varying(160), "file_url" text NOT NULL, "issue_date" date, "expiry_date" date, "verified" boolean NOT NULL DEFAULT false, "created_by" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "PK_b5805e41001d410755048c8dfc4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5e6c9a2ead5eac088b317cb3ae" ON "student_documents" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_student_document_student" ON "student_documents" ("student_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "student_emergency_contacts" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "student_id" uuid NOT NULL, "name" character varying(160) NOT NULL, "relation" character varying(60), "phone" character varying(40) NOT NULL, "alternate_phone" character varying(40), "priority" integer NOT NULL DEFAULT '1', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_96818da0c530ef14de057255cfe" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a26e16f62c412b57cd217947d3" ON "student_emergency_contacts" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_student_emergency_contact_student" ON "student_emergency_contacts" ("student_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "student_medical_records" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "student_id" uuid NOT NULL, "blood_group" character varying(8), "height_cm" numeric(5,2), "weight_kg" numeric(5,2), "allergies" text, "medical_conditions" text, "disabilities" text, "doctor_name" character varying(160), "doctor_phone" character varying(40), "insurance_info" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "REL_4c46e4ceaae9ebbbe8fbb525b6" UNIQUE ("student_id"), CONSTRAINT "PK_2f0d9f1985808560091c408b544" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7a4b86a788e12af30621179bc9" ON "student_medical_records" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_student_medical_record" ON "student_medical_records" ("org_id", "student_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "student_notes" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "student_id" uuid NOT NULL, "note_type" character varying(16) NOT NULL DEFAULT 'general', "note" text NOT NULL, "created_by" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "PK_257514e973a4a2a4a41e6e1e6f7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2aee86c606bed75fd3d425e8d4" ON "student_notes" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_student_note_student" ON "student_notes" ("student_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "students" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "admission_number" character varying(60) NOT NULL, "first_name" character varying NOT NULL, "middle_name" character varying, "last_name" character varying NOT NULL, "dob" date, "gender" character varying(16), "religion" character varying(60), "nationality" character varying(60), "email" character varying, "phone" character varying(40), "photo_url" text, "address" text, "admission_date" date, "admission_type" character varying(16), "status" character varying NOT NULL DEFAULT 'active', "user_id" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "PK_7d7f07271ad4ce999880713f05e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cee3bc4bee1f4e13c1e71dc255" ON "students" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_students_org_admission_number" ON "students" ("org_id", "admission_number") `,
    );
    await queryRunner.query(
      `CREATE TABLE "stakeholders" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "type" character varying(32) NOT NULL, "organization" character varying(160), "email" character varying, "phone" character varying(40), "address" text, "notes" text, "status" character varying NOT NULL DEFAULT 'active', "user_id" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "PK_74b5b503a4a44039a4a4b117ec6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2218d7efed1410cc2dcf806b97" ON "stakeholders" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "roles" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" character varying(255), "permissions" text array NOT NULL DEFAULT '{}', "is_system" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ba4f96af4628cc8b18e940436d" ON "roles" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_roles_org_name" ON "roles" ("org_id", "name") `,
    );
    await queryRunner.query(
      `CREATE TABLE "user_roles" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "role_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8acd5cf26ebd158416f477de799" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7e415bc729870c21ac0d12d746" ON "user_roles" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_user_roles_user_role" ON "user_roles" ("org_id", "user_id", "role_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "student_promotions" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "student_id" uuid NOT NULL, "from_year_id" uuid NOT NULL, "to_year_id" uuid NOT NULL, "from_class_id" uuid NOT NULL, "to_class_id" uuid NOT NULL, "from_section_id" uuid, "to_section_id" uuid, "promotion_date" date, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b1f7041c5f21cff8bf7947275b7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7e4f84216e45570284e9550932" ON "student_promotions" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "products" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" text NOT NULL, "price" numeric(10,2) NOT NULL, "stock" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e709b3421913dcef3ab9b4794e" ON "products" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "student_enrollments" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "student_id" uuid NOT NULL, "academic_year_id" uuid NOT NULL, "class_id" uuid NOT NULL, "section_id" uuid NOT NULL, "roll_no" character varying(40), "status" character varying(16) NOT NULL DEFAULT 'active', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_65f64fb270d4575b099b16e00a2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_14a392a3bdc3a8440b285544b6" ON "student_enrollments" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_enrollment_roll" ON "student_enrollments" ("org_id", "academic_year_id", "class_id", "section_id", "roll_no") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_enrollment_student_year" ON "student_enrollments" ("org_id", "student_id", "academic_year_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "student_subjects" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "student_enrollment_id" uuid NOT NULL, "subject_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b3854d8a2bd41a6396b559a37c9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_19dffa5a8491e5742e62f3ff2c" ON "student_subjects" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_student_subject" ON "student_subjects" ("org_id", "student_enrollment_id", "subject_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "class_subjects" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "class_id" uuid NOT NULL, "subject_id" uuid NOT NULL, "academic_year_id" uuid NOT NULL, "is_compulsory" boolean NOT NULL DEFAULT true, "weekly_classes" integer, "pass_marks" integer, "full_marks" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4e1ecabd8771166a29291dc09ed" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2d438f967f810b973c428eecf1" ON "class_subjects" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_class_subject" ON "class_subjects" ("org_id", "class_id", "subject_id", "academic_year_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "class_subject_groups" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "class_id" uuid NOT NULL, "subject_group_id" uuid NOT NULL, "academic_year_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1abb4de1ebc3d8cacb19b4b95f1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3d236d98842e4b5ddae5c7c34a" ON "class_subject_groups" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_class_subject_group" ON "class_subject_groups" ("org_id", "class_id", "subject_group_id", "academic_year_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "auth_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "org_id" uuid, "token_hash" character varying(64) NOT NULL, "type" character varying(32) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_41e9ddfbb32da18c4e85e45c2fd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5025d2f8422ef321bf17b5eabd" ON "auth_tokens" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_auth_tokens_hash" ON "auth_tokens" ("token_hash") `,
    );
    await queryRunner.query(
      `CREATE TABLE "cats" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "breed" character varying(120), "age" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_611e3c0a930b4ddc1541422864c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9173f117e5c501be386b9c4261" ON "cats" ("org_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "memberships" ADD CONSTRAINT "FK_7c1e2fdfed4f6838e0c05ae5051" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "memberships" ADD CONSTRAINT "FK_8c6a511c72951c42e008f5537dc" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "periods" ADD CONSTRAINT "FK_5cc03bb83c3c37f1327cbe2d3be" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "academic_years" ADD CONSTRAINT "FK_9960bb4643f2cad8ca81eaaa351" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sections" ADD CONSTRAINT "FK_4ada0895ef0e4e62ae0572437fe" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_sections" ADD CONSTRAINT "FK_4c23981775ca38c84a93be61dda" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_sections" ADD CONSTRAINT "FK_686a975f76c959428d568702f8c" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_sections" ADD CONSTRAINT "FK_b2337a9e16da03be643618833a3" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "classes" ADD CONSTRAINT "FK_46b99667b3ff4c3bc7672193140" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "departments" ADD CONSTRAINT "FK_3cfef557719b71f778c7e8ce7a2" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "designations" ADD CONSTRAINT "FK_83c50a9e2afff0b83c663f6fe9e" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "employees" ADD CONSTRAINT "FK_b75e1cf8e5b4de783e41263b15f" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "employees" ADD CONSTRAINT "FK_678a3540f843823784b0fe4a4f2" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "employees" ADD CONSTRAINT "FK_2de5d6e4fb3345f18bc467017f0" FOREIGN KEY ("designation_id") REFERENCES "designations"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "employees" ADD CONSTRAINT "FK_2d83c53c3e553a48dadb9722e38" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subjects" ADD CONSTRAINT "FK_fd66a1b32161cdbab76cd0d1d24" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_timetables" ADD CONSTRAINT "FK_0312af1f3cb76cbf3c7a28debcd" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_timetables" ADD CONSTRAINT "FK_e8cc273cde5ed474a7a79feaadb" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_timetables" ADD CONSTRAINT "FK_33f059d7dbea1c3df18198750ba" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_timetables" ADD CONSTRAINT "FK_9db1bd78eee77f5085f7a4d7817" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_timetables" ADD CONSTRAINT "FK_4f6035bcc9f72109c8fd853b473" FOREIGN KEY ("period_id") REFERENCES "periods"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_timetables" ADD CONSTRAINT "FK_d268fe1468677bda4124b3aa35f" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_timetables" ADD CONSTRAINT "FK_c5a7c529fdf57586e60001231e9" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_teachers" ADD CONSTRAINT "FK_1177103528119c62c988ea8daf6" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_teachers" ADD CONSTRAINT "FK_006773c0573d07a3b56c7cba945" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_teachers" ADD CONSTRAINT "FK_997ae3e78351217585bae1851f5" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_teachers" ADD CONSTRAINT "FK_eb3a86e223ac7c3b5d4eddbfaf9" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_teachers" ADD CONSTRAINT "FK_32867665af946b0f2c708861580" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_teachers" ADD CONSTRAINT "FK_68930772afd92b0e9034dd0a6be" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_teachers" ADD CONSTRAINT "FK_f61b2b59700e7c47e5b48dc38a8" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_teachers" ADD CONSTRAINT "FK_1192d6f4432d1de68d66e9a9cd7" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_teachers" ADD CONSTRAINT "FK_ec38809f1d50ce1db3839e4bc24" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_teachers" ADD CONSTRAINT "FK_6e7cc6e84938c3059dbac5862ec" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_teachers" ADD CONSTRAINT "FK_dc6f3f7a5b36cb0774faa88fcd7" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_6a7a4f687b74075698d59c172b5" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_group_subjects" ADD CONSTRAINT "FK_f27a281a1762c469983af9cee3a" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_group_subjects" ADD CONSTRAINT "FK_708f7a19366f8245b7d79402587" FOREIGN KEY ("subject_group_id") REFERENCES "subject_groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_group_subjects" ADD CONSTRAINT "FK_6df782df8061fd4a831c96f65a6" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_groups" ADD CONSTRAINT "FK_8240b25a97cbefb880bc14ce5e5" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "guardians" ADD CONSTRAINT "FK_a90286ac6c753390841d89d3763" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "guardians" ADD CONSTRAINT "FK_f1d05a3a2d70db0a25479b67189" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_guardians" ADD CONSTRAINT "FK_c2ed4b1ac1a1c3fda1748f99867" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_guardians" ADD CONSTRAINT "FK_8194052bdd62204f061dd44e0c9" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_guardians" ADD CONSTRAINT "FK_ec3cd56a2093be19f778af57c63" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_addresses" ADD CONSTRAINT "FK_002a60c49e7e8ccd7effe877108" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_addresses" ADD CONSTRAINT "FK_6dcaee6062ed8209816dd4d0833" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_documents" ADD CONSTRAINT "FK_5e6c9a2ead5eac088b317cb3ae3" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_documents" ADD CONSTRAINT "FK_8b0e086cbeca4ba69aadaac8541" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_emergency_contacts" ADD CONSTRAINT "FK_a26e16f62c412b57cd217947d30" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_emergency_contacts" ADD CONSTRAINT "FK_2c5e24436c54c70f249d5abbda6" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_medical_records" ADD CONSTRAINT "FK_7a4b86a788e12af30621179bc95" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_medical_records" ADD CONSTRAINT "FK_4c46e4ceaae9ebbbe8fbb525b64" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_notes" ADD CONSTRAINT "FK_2aee86c606bed75fd3d425e8d4c" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_notes" ADD CONSTRAINT "FK_260a8581782d7b51536ae22dfac" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "students" ADD CONSTRAINT "FK_cee3bc4bee1f4e13c1e71dc255a" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "students" ADD CONSTRAINT "FK_fb3eff90b11bddf7285f9b4e281" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "stakeholders" ADD CONSTRAINT "FK_2218d7efed1410cc2dcf806b975" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "stakeholders" ADD CONSTRAINT "FK_1159b452acb3cbfd3a126795a65" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "roles" ADD CONSTRAINT "FK_ba4f96af4628cc8b18e940436d8" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" ADD CONSTRAINT "FK_7e415bc729870c21ac0d12d7469" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" ADD CONSTRAINT "FK_87b8888186ca9769c960e926870" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" ADD CONSTRAINT "FK_b23c65e50a758245a33ee35fda1" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_promotions" ADD CONSTRAINT "FK_7e4f84216e45570284e95509326" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_promotions" ADD CONSTRAINT "FK_8b5a02b2d1bd921d1343e0751e1" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_promotions" ADD CONSTRAINT "FK_259206ca4cdc48c9a9f6f1a34cb" FOREIGN KEY ("from_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_promotions" ADD CONSTRAINT "FK_e2dd6049ef927f0d7d066c748ad" FOREIGN KEY ("to_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_promotions" ADD CONSTRAINT "FK_1f6fecc9cb339fdf3baa72106f9" FOREIGN KEY ("from_class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_promotions" ADD CONSTRAINT "FK_b897ed65b14f94884075483b73b" FOREIGN KEY ("to_class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_promotions" ADD CONSTRAINT "FK_c2954e70327a5cd906e8bdf1fd2" FOREIGN KEY ("from_section_id") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_promotions" ADD CONSTRAINT "FK_7f87ccae480386041fe16049519" FOREIGN KEY ("to_section_id") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "FK_e709b3421913dcef3ab9b4794e2" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_enrollments" ADD CONSTRAINT "FK_14a392a3bdc3a8440b285544b69" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_enrollments" ADD CONSTRAINT "FK_08caafd8a026a19ecf54db0e958" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_enrollments" ADD CONSTRAINT "FK_d0d2229aea2c212e21bc66628a0" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_enrollments" ADD CONSTRAINT "FK_e875df488b1b297f25e3dff3039" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_enrollments" ADD CONSTRAINT "FK_a504e03e002336b6bf7f17d6212" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_subjects" ADD CONSTRAINT "FK_19dffa5a8491e5742e62f3ff2cb" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_subjects" ADD CONSTRAINT "FK_72f1a3a2d7d3ae30eedaf7f0e43" FOREIGN KEY ("student_enrollment_id") REFERENCES "student_enrollments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_subjects" ADD CONSTRAINT "FK_b15a9dded530d955f809d0a51c8" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_subjects" ADD CONSTRAINT "FK_2d438f967f810b973c428eecf18" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_subjects" ADD CONSTRAINT "FK_433f93dd22b685e59c285726a1f" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_subjects" ADD CONSTRAINT "FK_9d8971acdcc64a1703357a00759" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_subjects" ADD CONSTRAINT "FK_f4622ca4b5c253658c080a2a59c" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_subject_groups" ADD CONSTRAINT "FK_3d236d98842e4b5ddae5c7c34a6" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_subject_groups" ADD CONSTRAINT "FK_293e6cf0b70998d63ae6a9eaa99" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_subject_groups" ADD CONSTRAINT "FK_e0e2bc2b65f76edf7786a9ae20d" FOREIGN KEY ("subject_group_id") REFERENCES "subject_groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_subject_groups" ADD CONSTRAINT "FK_416641e2819020df6506f73fe2f" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_tokens" ADD CONSTRAINT "FK_5025d2f8422ef321bf17b5eabd8" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cats" ADD CONSTRAINT "FK_9173f117e5c501be386b9c4261c" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cats" DROP CONSTRAINT "FK_9173f117e5c501be386b9c4261c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_tokens" DROP CONSTRAINT "FK_5025d2f8422ef321bf17b5eabd8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_subject_groups" DROP CONSTRAINT "FK_416641e2819020df6506f73fe2f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_subject_groups" DROP CONSTRAINT "FK_e0e2bc2b65f76edf7786a9ae20d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_subject_groups" DROP CONSTRAINT "FK_293e6cf0b70998d63ae6a9eaa99"`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_subject_groups" DROP CONSTRAINT "FK_3d236d98842e4b5ddae5c7c34a6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_subjects" DROP CONSTRAINT "FK_f4622ca4b5c253658c080a2a59c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_subjects" DROP CONSTRAINT "FK_9d8971acdcc64a1703357a00759"`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_subjects" DROP CONSTRAINT "FK_433f93dd22b685e59c285726a1f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_subjects" DROP CONSTRAINT "FK_2d438f967f810b973c428eecf18"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_subjects" DROP CONSTRAINT "FK_b15a9dded530d955f809d0a51c8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_subjects" DROP CONSTRAINT "FK_72f1a3a2d7d3ae30eedaf7f0e43"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_subjects" DROP CONSTRAINT "FK_19dffa5a8491e5742e62f3ff2cb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_enrollments" DROP CONSTRAINT "FK_a504e03e002336b6bf7f17d6212"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_enrollments" DROP CONSTRAINT "FK_e875df488b1b297f25e3dff3039"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_enrollments" DROP CONSTRAINT "FK_d0d2229aea2c212e21bc66628a0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_enrollments" DROP CONSTRAINT "FK_08caafd8a026a19ecf54db0e958"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_enrollments" DROP CONSTRAINT "FK_14a392a3bdc3a8440b285544b69"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" DROP CONSTRAINT "FK_e709b3421913dcef3ab9b4794e2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_promotions" DROP CONSTRAINT "FK_7f87ccae480386041fe16049519"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_promotions" DROP CONSTRAINT "FK_c2954e70327a5cd906e8bdf1fd2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_promotions" DROP CONSTRAINT "FK_b897ed65b14f94884075483b73b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_promotions" DROP CONSTRAINT "FK_1f6fecc9cb339fdf3baa72106f9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_promotions" DROP CONSTRAINT "FK_e2dd6049ef927f0d7d066c748ad"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_promotions" DROP CONSTRAINT "FK_259206ca4cdc48c9a9f6f1a34cb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_promotions" DROP CONSTRAINT "FK_8b5a02b2d1bd921d1343e0751e1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_promotions" DROP CONSTRAINT "FK_7e4f84216e45570284e95509326"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" DROP CONSTRAINT "FK_b23c65e50a758245a33ee35fda1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" DROP CONSTRAINT "FK_87b8888186ca9769c960e926870"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" DROP CONSTRAINT "FK_7e415bc729870c21ac0d12d7469"`,
    );
    await queryRunner.query(
      `ALTER TABLE "roles" DROP CONSTRAINT "FK_ba4f96af4628cc8b18e940436d8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stakeholders" DROP CONSTRAINT "FK_1159b452acb3cbfd3a126795a65"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stakeholders" DROP CONSTRAINT "FK_2218d7efed1410cc2dcf806b975"`,
    );
    await queryRunner.query(
      `ALTER TABLE "students" DROP CONSTRAINT "FK_fb3eff90b11bddf7285f9b4e281"`,
    );
    await queryRunner.query(
      `ALTER TABLE "students" DROP CONSTRAINT "FK_cee3bc4bee1f4e13c1e71dc255a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_notes" DROP CONSTRAINT "FK_260a8581782d7b51536ae22dfac"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_notes" DROP CONSTRAINT "FK_2aee86c606bed75fd3d425e8d4c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_medical_records" DROP CONSTRAINT "FK_4c46e4ceaae9ebbbe8fbb525b64"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_medical_records" DROP CONSTRAINT "FK_7a4b86a788e12af30621179bc95"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_emergency_contacts" DROP CONSTRAINT "FK_2c5e24436c54c70f249d5abbda6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_emergency_contacts" DROP CONSTRAINT "FK_a26e16f62c412b57cd217947d30"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_documents" DROP CONSTRAINT "FK_8b0e086cbeca4ba69aadaac8541"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_documents" DROP CONSTRAINT "FK_5e6c9a2ead5eac088b317cb3ae3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_addresses" DROP CONSTRAINT "FK_6dcaee6062ed8209816dd4d0833"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_addresses" DROP CONSTRAINT "FK_002a60c49e7e8ccd7effe877108"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_guardians" DROP CONSTRAINT "FK_ec3cd56a2093be19f778af57c63"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_guardians" DROP CONSTRAINT "FK_8194052bdd62204f061dd44e0c9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_guardians" DROP CONSTRAINT "FK_c2ed4b1ac1a1c3fda1748f99867"`,
    );
    await queryRunner.query(
      `ALTER TABLE "guardians" DROP CONSTRAINT "FK_f1d05a3a2d70db0a25479b67189"`,
    );
    await queryRunner.query(
      `ALTER TABLE "guardians" DROP CONSTRAINT "FK_a90286ac6c753390841d89d3763"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_groups" DROP CONSTRAINT "FK_8240b25a97cbefb880bc14ce5e5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_group_subjects" DROP CONSTRAINT "FK_6df782df8061fd4a831c96f65a6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_group_subjects" DROP CONSTRAINT "FK_708f7a19366f8245b7d79402587"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_group_subjects" DROP CONSTRAINT "FK_f27a281a1762c469983af9cee3a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_6a7a4f687b74075698d59c172b5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_teachers" DROP CONSTRAINT "FK_dc6f3f7a5b36cb0774faa88fcd7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_teachers" DROP CONSTRAINT "FK_6e7cc6e84938c3059dbac5862ec"`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_teachers" DROP CONSTRAINT "FK_ec38809f1d50ce1db3839e4bc24"`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_teachers" DROP CONSTRAINT "FK_1192d6f4432d1de68d66e9a9cd7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_teachers" DROP CONSTRAINT "FK_f61b2b59700e7c47e5b48dc38a8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_teachers" DROP CONSTRAINT "FK_68930772afd92b0e9034dd0a6be"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_teachers" DROP CONSTRAINT "FK_32867665af946b0f2c708861580"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_teachers" DROP CONSTRAINT "FK_eb3a86e223ac7c3b5d4eddbfaf9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_teachers" DROP CONSTRAINT "FK_997ae3e78351217585bae1851f5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_teachers" DROP CONSTRAINT "FK_006773c0573d07a3b56c7cba945"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_teachers" DROP CONSTRAINT "FK_1177103528119c62c988ea8daf6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_timetables" DROP CONSTRAINT "FK_c5a7c529fdf57586e60001231e9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_timetables" DROP CONSTRAINT "FK_d268fe1468677bda4124b3aa35f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_timetables" DROP CONSTRAINT "FK_4f6035bcc9f72109c8fd853b473"`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_timetables" DROP CONSTRAINT "FK_9db1bd78eee77f5085f7a4d7817"`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_timetables" DROP CONSTRAINT "FK_33f059d7dbea1c3df18198750ba"`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_timetables" DROP CONSTRAINT "FK_e8cc273cde5ed474a7a79feaadb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_timetables" DROP CONSTRAINT "FK_0312af1f3cb76cbf3c7a28debcd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subjects" DROP CONSTRAINT "FK_fd66a1b32161cdbab76cd0d1d24"`,
    );
    await queryRunner.query(
      `ALTER TABLE "employees" DROP CONSTRAINT "FK_2d83c53c3e553a48dadb9722e38"`,
    );
    await queryRunner.query(
      `ALTER TABLE "employees" DROP CONSTRAINT "FK_2de5d6e4fb3345f18bc467017f0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "employees" DROP CONSTRAINT "FK_678a3540f843823784b0fe4a4f2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "employees" DROP CONSTRAINT "FK_b75e1cf8e5b4de783e41263b15f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "designations" DROP CONSTRAINT "FK_83c50a9e2afff0b83c663f6fe9e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "departments" DROP CONSTRAINT "FK_3cfef557719b71f778c7e8ce7a2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "classes" DROP CONSTRAINT "FK_46b99667b3ff4c3bc7672193140"`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_sections" DROP CONSTRAINT "FK_b2337a9e16da03be643618833a3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_sections" DROP CONSTRAINT "FK_686a975f76c959428d568702f8c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_sections" DROP CONSTRAINT "FK_4c23981775ca38c84a93be61dda"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sections" DROP CONSTRAINT "FK_4ada0895ef0e4e62ae0572437fe"`,
    );
    await queryRunner.query(
      `ALTER TABLE "academic_years" DROP CONSTRAINT "FK_9960bb4643f2cad8ca81eaaa351"`,
    );
    await queryRunner.query(
      `ALTER TABLE "periods" DROP CONSTRAINT "FK_5cc03bb83c3c37f1327cbe2d3be"`,
    );
    await queryRunner.query(
      `ALTER TABLE "memberships" DROP CONSTRAINT "FK_8c6a511c72951c42e008f5537dc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "memberships" DROP CONSTRAINT "FK_7c1e2fdfed4f6838e0c05ae5051"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9173f117e5c501be386b9c4261"`,
    );
    await queryRunner.query(`DROP TABLE "cats"`);
    await queryRunner.query(`DROP INDEX "public"."uq_auth_tokens_hash"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5025d2f8422ef321bf17b5eabd"`,
    );
    await queryRunner.query(`DROP TABLE "auth_tokens"`);
    await queryRunner.query(`DROP INDEX "public"."uq_class_subject_group"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3d236d98842e4b5ddae5c7c34a"`,
    );
    await queryRunner.query(`DROP TABLE "class_subject_groups"`);
    await queryRunner.query(`DROP INDEX "public"."uq_class_subject"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2d438f967f810b973c428eecf1"`,
    );
    await queryRunner.query(`DROP TABLE "class_subjects"`);
    await queryRunner.query(`DROP INDEX "public"."uq_student_subject"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_19dffa5a8491e5742e62f3ff2c"`,
    );
    await queryRunner.query(`DROP TABLE "student_subjects"`);
    await queryRunner.query(`DROP INDEX "public"."uq_enrollment_student_year"`);
    await queryRunner.query(`DROP INDEX "public"."uq_enrollment_roll"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_14a392a3bdc3a8440b285544b6"`,
    );
    await queryRunner.query(`DROP TABLE "student_enrollments"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e709b3421913dcef3ab9b4794e"`,
    );
    await queryRunner.query(`DROP TABLE "products"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7e4f84216e45570284e9550932"`,
    );
    await queryRunner.query(`DROP TABLE "student_promotions"`);
    await queryRunner.query(`DROP INDEX "public"."uq_user_roles_user_role"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7e415bc729870c21ac0d12d746"`,
    );
    await queryRunner.query(`DROP TABLE "user_roles"`);
    await queryRunner.query(`DROP INDEX "public"."uq_roles_org_name"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ba4f96af4628cc8b18e940436d"`,
    );
    await queryRunner.query(`DROP TABLE "roles"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2218d7efed1410cc2dcf806b97"`,
    );
    await queryRunner.query(`DROP TABLE "stakeholders"`);
    await queryRunner.query(
      `DROP INDEX "public"."uq_students_org_admission_number"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cee3bc4bee1f4e13c1e71dc255"`,
    );
    await queryRunner.query(`DROP TABLE "students"`);
    await queryRunner.query(`DROP INDEX "public"."idx_student_note_student"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2aee86c606bed75fd3d425e8d4"`,
    );
    await queryRunner.query(`DROP TABLE "student_notes"`);
    await queryRunner.query(`DROP INDEX "public"."uq_student_medical_record"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7a4b86a788e12af30621179bc9"`,
    );
    await queryRunner.query(`DROP TABLE "student_medical_records"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_student_emergency_contact_student"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a26e16f62c412b57cd217947d3"`,
    );
    await queryRunner.query(`DROP TABLE "student_emergency_contacts"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_student_document_student"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5e6c9a2ead5eac088b317cb3ae"`,
    );
    await queryRunner.query(`DROP TABLE "student_documents"`);
    await queryRunner.query(`DROP INDEX "public"."uq_student_address_type"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_002a60c49e7e8ccd7effe87710"`,
    );
    await queryRunner.query(`DROP TABLE "student_addresses"`);
    await queryRunner.query(`DROP INDEX "public"."uq_student_guardian"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c2ed4b1ac1a1c3fda1748f9986"`,
    );
    await queryRunner.query(`DROP TABLE "student_guardians"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a90286ac6c753390841d89d376"`,
    );
    await queryRunner.query(`DROP TABLE "guardians"`);
    await queryRunner.query(`DROP INDEX "public"."uq_subject_groups_org_name"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8240b25a97cbefb880bc14ce5e"`,
    );
    await queryRunner.query(`DROP TABLE "subject_groups"`);
    await queryRunner.query(`DROP INDEX "public"."uq_subject_group_subject"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f27a281a1762c469983af9cee3"`,
    );
    await queryRunner.query(`DROP TABLE "subject_group_subjects"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6a7a4f687b74075698d59c172b"`,
    );
    await queryRunner.query(`DROP TABLE "tasks"`);
    await queryRunner.query(`DROP TYPE "public"."tasks_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."uq_class_teacher"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f61b2b59700e7c47e5b48dc38a"`,
    );
    await queryRunner.query(`DROP TABLE "class_teachers"`);
    await queryRunner.query(`DROP INDEX "public"."uq_subject_teacher"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1177103528119c62c988ea8daf"`,
    );
    await queryRunner.query(`DROP TABLE "subject_teachers"`);
    await queryRunner.query(`DROP INDEX "public"."uq_timetable_slot"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0312af1f3cb76cbf3c7a28debc"`,
    );
    await queryRunner.query(`DROP TABLE "class_timetables"`);
    await queryRunner.query(`DROP INDEX "public"."uq_subjects_org_name"`);
    await queryRunner.query(`DROP INDEX "public"."uq_subjects_org_code"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fd66a1b32161cdbab76cd0d1d2"`,
    );
    await queryRunner.query(`DROP TABLE "subjects"`);
    await queryRunner.query(
      `DROP INDEX "public"."uq_employees_org_employee_number"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b75e1cf8e5b4de783e41263b15"`,
    );
    await queryRunner.query(`DROP TABLE "employees"`);
    await queryRunner.query(`DROP INDEX "public"."uq_designations_org_title"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_83c50a9e2afff0b83c663f6fe9"`,
    );
    await queryRunner.query(`DROP TABLE "designations"`);
    await queryRunner.query(`DROP INDEX "public"."uq_departments_org_name"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3cfef557719b71f778c7e8ce7a"`,
    );
    await queryRunner.query(`DROP TABLE "departments"`);
    await queryRunner.query(`DROP INDEX "public"."uq_classes_org_name"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_46b99667b3ff4c3bc767219314"`,
    );
    await queryRunner.query(`DROP TABLE "classes"`);
    await queryRunner.query(`DROP INDEX "public"."uq_class_section"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4c23981775ca38c84a93be61dd"`,
    );
    await queryRunner.query(`DROP TABLE "class_sections"`);
    await queryRunner.query(`DROP INDEX "public"."uq_sections_org_name"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4ada0895ef0e4e62ae0572437f"`,
    );
    await queryRunner.query(`DROP TABLE "sections"`);
    await queryRunner.query(`DROP INDEX "public"."uq_academic_years_org_name"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9960bb4643f2cad8ca81eaaa35"`,
    );
    await queryRunner.query(`DROP TABLE "academic_years"`);
    await queryRunner.query(`DROP INDEX "public"."uq_periods_org_name"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5cc03bb83c3c37f1327cbe2d3b"`,
    );
    await queryRunner.query(`DROP TABLE "periods"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."users_platform_role_enum"`);
    await queryRunner.query(`DROP INDEX "public"."uq_memberships_org_user"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8c6a511c72951c42e008f5537d"`,
    );
    await queryRunner.query(`DROP TABLE "memberships"`);
    await queryRunner.query(`DROP TYPE "public"."memberships_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."memberships_role_enum"`);
    await queryRunner.query(`DROP TABLE "organizations"`);
    await queryRunner.query(`DROP TYPE "public"."organizations_status_enum"`);
  }
}
