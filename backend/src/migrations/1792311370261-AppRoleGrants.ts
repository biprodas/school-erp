import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Narrows the restricted app role (`DB_APP_USERNAME`, the role the tenant
 * pool connects as) from "DML on every table" to the tables tenant requests
 * use: the org-scoped tables (all under RLS) plus `users` and `auth_tokens`.
 * It loses `organizations`, `migrations` and anything created later.
 *
 * The list is frozen here on purpose: a migration that creates a tenanted
 * table must enable its RLS policy and grant the app role on it as well.
 * Skipped when `DB_APP_USERNAME` is not set where migrations run.
 */
const APP_ROLE_TABLES = [
  'academic_years',
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
  'user_roles',
  // Global tables used by tenant sign-in and account flows.
  'users',
  'auth_tokens',
];

const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;

async function appRole(queryRunner: QueryRunner): Promise<string | null> {
  const name = process.env.DB_APP_USERNAME?.trim();
  if (!name) {
    console.warn('AppRoleGrants: DB_APP_USERNAME is not set, skipping.');
    return null;
  }
  const rows = (await queryRunner.query(
    'SELECT 1 FROM pg_roles WHERE rolname = $1',
    [name],
  )) as unknown[];
  if (!rows.length) {
    throw new Error(
      `AppRoleGrants: role "${name}" does not exist. Create it first (see backend/README.md).`,
    );
  }
  return quoteIdent(name);
}

export class AppRoleGrants1792311370261 implements MigrationInterface {
  name = 'AppRoleGrants1792311370261';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const role = await appRole(queryRunner);
    if (!role) return;
    const tables = APP_ROLE_TABLES.map((t) => `public.${quoteIdent(t)}`);

    await queryRunner.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
    await queryRunner.query(
      `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${role}`,
    );
    await queryRunner.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM ${role}`,
    );
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ${tables.join(', ')} TO ${role}`,
    );
    await queryRunner.query(
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role}`,
    );
  }

  /** Back to the previously documented broad grants. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    const role = await appRole(queryRunner);
    if (!role) return;
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${role}`,
    );
    await queryRunner.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${role}`,
    );
  }
}
