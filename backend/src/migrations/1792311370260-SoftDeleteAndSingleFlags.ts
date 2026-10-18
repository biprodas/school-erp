import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * - Soft-deleted rows no longer block unique business keys: admission
 *   numbers, employee numbers and academic year names are unique among live
 *   rows only (the services already ignore deleted rows when checking).
 * - "Only one" flags are enforced by the database, not just by the services'
 *   clear-then-set, which two concurrent requests could both pass:
 *   one current academic year per school, one primary class teacher per
 *   class-section and year, one primary guardian per student.
 *
 * Before adding those, existing duplicates (left by such races) are resolved
 * by keeping the most recently updated row flagged.
 */
export class SoftDeleteAndSingleFlags1792311370260 implements MigrationInterface {
  name = 'SoftDeleteAndSingleFlags1792311370260';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "academic_years" SET "is_current" = false
      WHERE "is_current" AND "deleted_at" IS NULL AND "id" NOT IN (
        SELECT DISTINCT ON ("org_id") "id" FROM "academic_years"
        WHERE "is_current" AND "deleted_at" IS NULL
        ORDER BY "org_id", "updated_at" DESC
      )`);
    await queryRunner.query(`
      UPDATE "class_teachers" SET "is_primary" = false
      WHERE "is_primary" AND "id" NOT IN (
        SELECT DISTINCT ON ("org_id", "academic_year_id", "class_id", "section_id") "id"
        FROM "class_teachers" WHERE "is_primary"
        ORDER BY "org_id", "academic_year_id", "class_id", "section_id", "updated_at" DESC
      )`);
    await queryRunner.query(`
      UPDATE "student_guardians" SET "is_primary" = false
      WHERE "is_primary" AND "id" NOT IN (
        SELECT DISTINCT ON ("org_id", "student_id") "id"
        FROM "student_guardians" WHERE "is_primary"
        ORDER BY "org_id", "student_id", "created_at" DESC
      )`);

    await queryRunner.query(`DROP INDEX "public"."uq_academic_years_org_name"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_academic_years_org_name" ON "academic_years" ("org_id", "name") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_employees_org_employee_number"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_employees_org_employee_number" ON "employees" ("org_id", "employee_number") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_students_org_admission_number"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_students_org_admission_number" ON "students" ("org_id", "admission_number") WHERE "deleted_at" IS NULL`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_academic_years_org_current" ON "academic_years" ("org_id") WHERE "is_current" AND "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_class_teachers_org_primary" ON "class_teachers" ("org_id", "academic_year_id", "class_id", "section_id") WHERE "is_primary"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_student_guardians_org_primary" ON "student_guardians" ("org_id", "student_id") WHERE "is_primary"`,
    );
  }

  /** Fails if soft-deleted rows now share a key with live rows. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."uq_student_guardians_org_primary"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_class_teachers_org_primary"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_academic_years_org_current"`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."uq_students_org_admission_number"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_students_org_admission_number" ON "students" ("org_id", "admission_number") `,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_employees_org_employee_number"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_employees_org_employee_number" ON "employees" ("org_id", "employee_number") `,
    );
    await queryRunner.query(`DROP INDEX "public"."uq_academic_years_org_name"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_academic_years_org_name" ON "academic_years" ("org_id", "name") `,
    );
  }
}
