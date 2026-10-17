import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enables the `org_isolation` RLS policy on every table with a NOT NULL
 * `org_id`, matching what `applyRowLevelSecurity` (src/tenancy/rls.ts) does
 * at dev boot. The table list is frozen here on purpose: a new tenanted table
 * must enable its policy in the migration that creates it.
 *
 * Grants for the restricted app role are not part of this migration; see
 * "Production" in backend/README.md.
 */
const ORG_SCOPED_TABLES = [
  'academic_years',
  'cats',
  'class_sections',
  'class_subject_groups',
  'class_subjects',
  'class_teachers',
  'class_timetables',
  'classes',
  'departments',
  'designations',
  'employees',
  'guardians',
  'memberships',
  'periods',
  'products',
  'roles',
  'sections',
  'stakeholders',
  'student_addresses',
  'student_documents',
  'student_emergency_contacts',
  'student_enrollments',
  'student_guardians',
  'student_medical_records',
  'student_notes',
  'student_promotions',
  'student_subjects',
  'students',
  'subject_group_subjects',
  'subject_groups',
  'subject_teachers',
  'subjects',
  'tasks',
  'user_roles',
];

const ORG_EXPR = `NULLIF(current_setting('app.org_id', true), '')::uuid`;

export class RowLevelSecurity1792231987094 implements MigrationInterface {
  name = 'RowLevelSecurity1792231987094';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ORG_SCOPED_TABLES) {
      await queryRunner.query(
        `ALTER TABLE public."${table}" ENABLE ROW LEVEL SECURITY`,
      );
      await queryRunner.query(
        `DROP POLICY IF EXISTS org_isolation ON public."${table}"`,
      );
      await queryRunner.query(
        `CREATE POLICY org_isolation ON public."${table}" USING (org_id = ${ORG_EXPR}) WITH CHECK (org_id = ${ORG_EXPR})`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ORG_SCOPED_TABLES) {
      await queryRunner.query(
        `DROP POLICY IF EXISTS org_isolation ON public."${table}"`,
      );
      await queryRunner.query(
        `ALTER TABLE public."${table}" DISABLE ROW LEVEL SECURITY`,
      );
    }
  }
}
