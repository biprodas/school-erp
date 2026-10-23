import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M2, per-session sections and effective-dated teachers (backend plan 6.2,
 * 6.4). Sections were a global name list joined to classes through
 * `class_sections`; now each section belongs to one class and one session.
 *
 * - Sections are rebuilt in place, so the table keeps its RLS policy and
 *   grants: a new row for every (class, old section, session) that any
 *   enrollment, teacher assignment, timetable entry or promotion uses, plus
 *   one in the current session for each `class_sections` link nothing used
 *   (no current session: such a link is dropped). Capacity and
 *   active flag come from the link.
 * - `student_enrollments`, `class_teachers`, `subject_teachers`,
 *   `class_timetables` and `student_promotions` are repointed to the new
 *   rows (match on class + old section + session); then `class_sections`
 *   and the old rows go. Enrollments now block deleting their section.
 * - Teacher assignments drop `class_id` / `academic_year_id` (the section
 *   implies them) and get `effective_from` (the session's first day, or the
 *   row's creation day) and `effective_to`; their unique keys cover current
 *   rows only. Subject teachers point at `class_subject_id`; a missing class
 *   subject is created (compulsory) so no assignment is lost.
 *
 * `down` is best-effort, for dev databases: it rebuilds global sections by
 * name and the class links, and drops ended (history) assignments, which
 * the old unique keys can't hold.
 */
const USAGE = `
  SELECT org_id, class_id, section_id, academic_year_id FROM student_enrollments
  UNION SELECT org_id, class_id, section_id, academic_year_id FROM class_teachers
  UNION SELECT org_id, class_id, section_id, academic_year_id FROM subject_teachers
  UNION SELECT org_id, class_id, section_id, academic_year_id FROM class_timetables
  UNION SELECT org_id, from_class_id, from_section_id, from_year_id
        FROM student_promotions WHERE from_section_id IS NOT NULL
  UNION SELECT org_id, to_class_id, to_section_id, to_year_id
        FROM student_promotions WHERE to_section_id IS NOT NULL`;

/** Tables whose (class_id, section_id, academic_year_id) are repointed. */
const PLACED = [
  'student_enrollments',
  'class_teachers',
  'subject_teachers',
  'class_timetables',
];

export class PerSessionSections1792350000001 implements MigrationInterface {
  name = 'PerSessionSections1792350000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- 1. Per-session rows next to the old global ones ----------------
    await queryRunner.query(`DROP INDEX "public"."uq_sections_org_name"`);
    await queryRunner.query(
      `ALTER TABLE "sections" ADD "academic_year_id" uuid, ADD "class_id" uuid, ADD "shift_id" uuid, ADD "capacity" integer, ADD "room_id" uuid, ADD "legacy_section_id" uuid`,
    );
    await queryRunner.query(`
      INSERT INTO "sections"
        ("org_id", "name", "is_active", "academic_year_id", "class_id", "capacity", "legacy_section_id")
      SELECT u.org_id, ls.name, COALESCE(cs.is_active, true), u.academic_year_id,
             u.class_id, cs.capacity, u.section_id
      FROM (
        ${USAGE}
        UNION
        SELECT cs.org_id, cs.class_id, cs.section_id, y.id
        FROM class_sections cs
        JOIN academic_years y
          ON y.org_id = cs.org_id AND y.is_current AND y.deleted_at IS NULL
        WHERE NOT EXISTS (
          SELECT 1 FROM (${USAGE}) used
          WHERE used.class_id = cs.class_id AND used.section_id = cs.section_id
        )
      ) u
      JOIN sections ls ON ls.id = u.section_id AND ls.academic_year_id IS NULL
      LEFT JOIN class_sections cs
        ON cs.class_id = u.class_id AND cs.section_id = u.section_id`);

    // --- 2. Repoint everything that names a section ---------------------
    // Enrollments block deleting a section from now on, so a row the
    // repointing missed stops the migration instead of being cascaded away.
    await queryRunner.query(
      `ALTER TABLE "student_enrollments" DROP CONSTRAINT "FK_a504e03e002336b6bf7f17d6212"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_enrollments" ADD CONSTRAINT "FK_a504e03e002336b6bf7f17d6212" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    for (const table of PLACED) {
      await queryRunner.query(`
        UPDATE "${table}" t SET "section_id" = s.id
        FROM "sections" s
        WHERE s.legacy_section_id = t.section_id
          AND s.class_id = t.class_id
          AND s.academic_year_id = t.academic_year_id`);
    }
    for (const side of ['from', 'to']) {
      await queryRunner.query(`
        UPDATE "student_promotions" p SET "${side}_section_id" = s.id
        FROM "sections" s
        WHERE s.legacy_section_id = p.${side}_section_id
          AND s.class_id = p.${side}_class_id
          AND s.academic_year_id = p.${side}_year_id`);
    }
    const [{ missed }] = (await queryRunner.query(`
      SELECT count(*)::int AS missed FROM (
        SELECT section_id FROM student_enrollments
        UNION ALL SELECT section_id FROM class_teachers
        UNION ALL SELECT section_id FROM subject_teachers
        UNION ALL SELECT section_id FROM class_timetables
      ) r JOIN sections s ON s.id = r.section_id
      WHERE s.academic_year_id IS NULL`)) as { missed: number }[];
    if (missed > 0) {
      throw new Error(
        `PerSessionSections: ${missed} row(s) still point at a global section`,
      );
    }

    // --- 3. Class teachers: by section, effective-dated -----------------
    await queryRunner.query(
      `ALTER TABLE "class_teachers" ADD "effective_from" date, ADD "effective_to" date`,
    );
    await queryRunner.query(`
      UPDATE "class_teachers" t
      SET "effective_from" = COALESCE(y.start_date, t.created_at::date)
      FROM "academic_years" y WHERE y.id = t.academic_year_id`);
    await queryRunner.query(
      `ALTER TABLE "class_teachers" ALTER COLUMN "effective_from" SET NOT NULL`,
    );
    await queryRunner.query(`DROP INDEX "public"."uq_class_teacher"`);
    await queryRunner.query(
      `DROP INDEX "public"."uq_class_teachers_org_primary"`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_teachers" DROP CONSTRAINT "FK_1192d6f4432d1de68d66e9a9cd7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_teachers" DROP CONSTRAINT "FK_dc6f3f7a5b36cb0774faa88fcd7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_teachers" DROP COLUMN "class_id", DROP COLUMN "academic_year_id"`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_class_teachers_employee" ON "class_teachers" ("org_id", "employee_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_class_teachers_org_primary" ON "class_teachers" ("org_id", "section_id") WHERE "is_primary" AND "effective_to" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_class_teachers_current" ON "class_teachers" ("org_id", "section_id", "employee_id") WHERE "effective_to" IS NULL`,
    );

    // --- 4. Subject teachers: by section and class subject --------------
    await queryRunner.query(`
      INSERT INTO "class_subjects" ("org_id", "class_id", "subject_id", "academic_year_id")
      SELECT DISTINCT st.org_id, st.class_id, st.subject_id, st.academic_year_id
      FROM "subject_teachers" st
      WHERE NOT EXISTS (
        SELECT 1 FROM "class_subjects" cs
        WHERE cs.org_id = st.org_id AND cs.class_id = st.class_id
          AND cs.subject_id = st.subject_id
          AND cs.academic_year_id = st.academic_year_id
      )`);
    await queryRunner.query(
      `ALTER TABLE "subject_teachers" ADD "class_subject_id" uuid, ADD "effective_from" date, ADD "effective_to" date`,
    );
    await queryRunner.query(`
      UPDATE "subject_teachers" st
      SET "class_subject_id" = cs.id,
          "effective_from" = COALESCE(y.start_date, st.created_at::date)
      FROM "class_subjects" cs, "academic_years" y
      WHERE cs.org_id = st.org_id AND cs.class_id = st.class_id
        AND cs.subject_id = st.subject_id
        AND cs.academic_year_id = st.academic_year_id
        AND y.id = st.academic_year_id`);
    await queryRunner.query(
      `ALTER TABLE "subject_teachers" ALTER COLUMN "class_subject_id" SET NOT NULL, ALTER COLUMN "effective_from" SET NOT NULL`,
    );
    await queryRunner.query(`DROP INDEX "public"."uq_subject_teacher"`);
    for (const fk of [
      'FK_006773c0573d07a3b56c7cba945',
      'FK_eb3a86e223ac7c3b5d4eddbfaf9',
      'FK_68930772afd92b0e9034dd0a6be',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "subject_teachers" DROP CONSTRAINT "${fk}"`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "subject_teachers" DROP COLUMN "class_id", DROP COLUMN "subject_id", DROP COLUMN "academic_year_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_teachers" ADD CONSTRAINT "FK_a4c1bd8e9bb2b3b496e0e162fbe" FOREIGN KEY ("class_subject_id") REFERENCES "class_subjects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_subject_teachers_employee" ON "subject_teachers" ("org_id", "employee_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_subject_teachers_current" ON "subject_teachers" ("org_id", "section_id", "class_subject_id", "employee_id") WHERE "effective_to" IS NULL`,
    );

    // --- 5. Drop the global names ---------------------------------------
    await queryRunner.query(`DROP TABLE "class_sections"`);
    await queryRunner.query(
      `DELETE FROM "sections" WHERE "academic_year_id" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "sections" DROP COLUMN "legacy_section_id", DROP COLUMN "code", DROP COLUMN "description"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sections" ALTER COLUMN "academic_year_id" SET NOT NULL, ALTER COLUMN "class_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_sections_org_year_class_name" ON "sections" ("org_id", "academic_year_id", "class_id", "name") `,
    );
    await queryRunner.query(
      `ALTER TABLE "sections" ADD CONSTRAINT "FK_a5d59ef3ae67c92d72f2164ac82" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sections" ADD CONSTRAINT "FK_27db91d7369af6f181412afa99f" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sections" ADD CONSTRAINT "FK_53737a18a404bc60cdcfb2ee4e0" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sections" ADD CONSTRAINT "FK_8cb4031f7556945bc3e155f57ff" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // --- Sections back to global names, plus class links ----------------
    for (const fk of [
      'FK_8cb4031f7556945bc3e155f57ff',
      'FK_53737a18a404bc60cdcfb2ee4e0',
      'FK_27db91d7369af6f181412afa99f',
      'FK_a5d59ef3ae67c92d72f2164ac82',
    ]) {
      await queryRunner.query(`ALTER TABLE "sections" DROP CONSTRAINT "${fk}"`);
    }
    await queryRunner.query(
      `DROP INDEX "public"."uq_sections_org_year_class_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sections" ALTER COLUMN "academic_year_id" DROP NOT NULL, ALTER COLUMN "class_id" DROP NOT NULL, ADD "code" character varying(40), ADD "description" text, ADD "global_id" uuid`,
    );
    await queryRunner.query(`
      INSERT INTO "sections" ("org_id", "name")
      SELECT DISTINCT "org_id", "name" FROM "sections"`);
    await queryRunner.query(`
      UPDATE "sections" s SET "global_id" = g.id
      FROM "sections" g
      WHERE g.academic_year_id IS NULL AND g.org_id = s.org_id
        AND g.name = s.name AND s.academic_year_id IS NOT NULL`);

    // Columns the per-session rows implied.
    await queryRunner.query(
      `ALTER TABLE "class_teachers" ADD "class_id" uuid, ADD "academic_year_id" uuid`,
    );
    await queryRunner.query(`
      UPDATE "class_teachers" t SET "class_id" = s.class_id, "academic_year_id" = s.academic_year_id
      FROM "sections" s WHERE s.id = t.section_id`);
    await queryRunner.query(
      `ALTER TABLE "subject_teachers" ADD "class_id" uuid, ADD "subject_id" uuid, ADD "academic_year_id" uuid`,
    );
    await queryRunner.query(`
      UPDATE "subject_teachers" t
      SET "class_id" = cs.class_id, "subject_id" = cs.subject_id,
          "academic_year_id" = cs.academic_year_id
      FROM "class_subjects" cs WHERE cs.id = t.class_subject_id`);
    // The old keys have no dates: history rows can't stay.
    await queryRunner.query(
      `DELETE FROM "class_teachers" WHERE "effective_to" IS NOT NULL`,
    );
    await queryRunner.query(
      `DELETE FROM "subject_teachers" WHERE "effective_to" IS NOT NULL`,
    );

    await queryRunner.query(
      `CREATE TABLE "class_sections" ("org_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "class_id" uuid NOT NULL, "section_id" uuid NOT NULL, "capacity" integer, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e33e202b8db5a2bb2d6d6f0c3b6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`
      INSERT INTO "class_sections" ("org_id", "class_id", "section_id", "capacity", "is_active")
      SELECT DISTINCT ON (s.class_id, s.global_id)
             s.org_id, s.class_id, s.global_id, s.capacity, s.is_active
      FROM "sections" s WHERE s.academic_year_id IS NOT NULL
      ORDER BY s.class_id, s.global_id, s.created_at DESC`);
    await queryRunner.query(
      `CREATE INDEX "IDX_4c23981775ca38c84a93be61dd" ON "class_sections" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_class_section" ON "class_sections" ("org_id", "class_id", "section_id") `,
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
      `ALTER TABLE public."class_sections" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `CREATE POLICY org_isolation ON public."class_sections" USING (org_id = NULLIF(current_setting('app.org_id', true), '')::uuid) WITH CHECK (org_id = NULLIF(current_setting('app.org_id', true), '')::uuid)`,
    );
    const role = process.env.DB_APP_USERNAME?.trim();
    if (role) {
      await queryRunner.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON public."class_sections" TO "${role.replace(/"/g, '""')}"`,
      );
    }

    for (const table of [...PLACED, 'student_promotions']) {
      const columns =
        table === 'student_promotions'
          ? ['from_section_id', 'to_section_id']
          : ['section_id'];
      for (const column of columns) {
        await queryRunner.query(`
          UPDATE "${table}" t SET "${column}" = s.global_id
          FROM "sections" s WHERE s.id = t.${column} AND s.global_id IS NOT NULL`);
      }
    }
    await queryRunner.query(
      `DELETE FROM "sections" WHERE "academic_year_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "sections" DROP COLUMN "global_id", DROP COLUMN "room_id", DROP COLUMN "capacity", DROP COLUMN "shift_id", DROP COLUMN "class_id", DROP COLUMN "academic_year_id"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_sections_org_name" ON "sections" ("org_id", "name") `,
    );

    // --- Teachers back to class + section + year keys -------------------
    await queryRunner.query(
      `DROP INDEX "public"."uq_subject_teachers_current"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_subject_teachers_employee"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_teachers" DROP CONSTRAINT "FK_a4c1bd8e9bb2b3b496e0e162fbe"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_teachers" DROP COLUMN "class_subject_id", DROP COLUMN "effective_from", DROP COLUMN "effective_to"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_teachers" ALTER COLUMN "class_id" SET NOT NULL, ALTER COLUMN "subject_id" SET NOT NULL, ALTER COLUMN "academic_year_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_subject_teacher" ON "subject_teachers" ("org_id", "academic_year_id", "class_id", "section_id", "subject_id", "employee_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_teachers" ADD CONSTRAINT "FK_68930772afd92b0e9034dd0a6be" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_teachers" ADD CONSTRAINT "FK_eb3a86e223ac7c3b5d4eddbfaf9" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subject_teachers" ADD CONSTRAINT "FK_006773c0573d07a3b56c7cba945" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(`DROP INDEX "public"."uq_class_teachers_current"`);
    await queryRunner.query(
      `DROP INDEX "public"."uq_class_teachers_org_primary"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_class_teachers_employee"`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_teachers" DROP COLUMN "effective_from", DROP COLUMN "effective_to"`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_teachers" ALTER COLUMN "class_id" SET NOT NULL, ALTER COLUMN "academic_year_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_class_teacher" ON "class_teachers" ("org_id", "academic_year_id", "class_id", "section_id", "employee_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_class_teachers_org_primary" ON "class_teachers" ("org_id", "academic_year_id", "class_id", "section_id") WHERE "is_primary"`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_teachers" ADD CONSTRAINT "FK_dc6f3f7a5b36cb0774faa88fcd7" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_teachers" ADD CONSTRAINT "FK_1192d6f4432d1de68d66e9a9cd7" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "student_enrollments" DROP CONSTRAINT "FK_a504e03e002336b6bf7f17d6212"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_enrollments" ADD CONSTRAINT "FK_a504e03e002336b6bf7f17d6212" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
