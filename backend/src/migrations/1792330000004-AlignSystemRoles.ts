import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Aligns every org's system roles with PRD 6.3 / the 4.4 matrix (backend plan
 * 4.4) and adds `roles.scope`:
 *
 * - `parent` becomes `guardian`; holders of `staff` move to `principal` and
 *   `staff` is dropped.
 * - Missing system roles are inserted; every system role's description,
 *   scope and permissions are rewritten. Custom roles keep their
 *   permissions; one that happens to use a new system role's name is renamed
 *   to "<name> (custom)" (or "<name> (custom 2)", … if that is taken too).
 *
 * The role sets are a frozen copy of `system-roles.seed.ts` at this point, so
 * later seed changes don't alter what this migration does.
 *
 * `down` is best-effort, for dev databases only: it renames `guardian` back
 * to `parent` and drops `roles.scope`, but leaves the new roles, permissions
 * and renamed custom roles as they are. It never recreates `staff` or hands
 * out roles, so rolling back can't widen anyone's access.
 */
const ROLES: {
  name: string;
  description: string;
  scope: 'school' | 'assigned';
  permissions: string[];
}[] = [
  {
    name: 'admin',
    description: 'Full school administrator',
    scope: 'school',
    permissions: [
      'users:read',
      'users:create',
      'users:update',
      'users:delete',
      'students:read',
      'students:create',
      'students:update',
      'students:delete',
      'student_documents:read',
      'student_documents:create',
      'student_documents:update',
      'student_documents:delete',
      'student_medical:read',
      'student_medical:create',
      'student_medical:update',
      'student_medical:delete',
      'student_notes:read',
      'student_notes:create',
      'student_notes:update',
      'student_notes:delete',
      'departments:read',
      'departments:create',
      'departments:update',
      'departments:delete',
      'designations:read',
      'designations:create',
      'designations:update',
      'designations:delete',
      'employees:read',
      'employees:create',
      'employees:update',
      'employees:delete',
      'guardians:read',
      'guardians:create',
      'guardians:update',
      'guardians:delete',
      'academic_years:read',
      'academic_years:create',
      'academic_years:update',
      'academic_years:delete',
      'classes:read',
      'classes:create',
      'classes:update',
      'classes:delete',
      'sections:read',
      'sections:create',
      'sections:update',
      'sections:delete',
      'subjects:read',
      'subjects:create',
      'subjects:update',
      'subjects:delete',
      'subject_groups:read',
      'subject_groups:create',
      'subject_groups:update',
      'subject_groups:delete',
      'class_subjects:read',
      'class_subjects:create',
      'class_subjects:update',
      'class_subjects:delete',
      'class_subject_groups:read',
      'class_subject_groups:create',
      'class_subject_groups:update',
      'class_subject_groups:delete',
      'enrollments:read',
      'enrollments:create',
      'enrollments:update',
      'enrollments:delete',
      'student_subjects:read',
      'student_subjects:create',
      'student_subjects:delete',
      'class_teachers:read',
      'class_teachers:create',
      'class_teachers:update',
      'class_teachers:delete',
      'subject_teachers:read',
      'subject_teachers:create',
      'subject_teachers:update',
      'subject_teachers:delete',
      'periods:read',
      'periods:create',
      'periods:update',
      'periods:delete',
      'timetables:read',
      'timetables:create',
      'timetables:update',
      'timetables:delete',
      'promotions:read',
      'promotions:create',
      'promotions:delete',
      'domains:read',
      'domains:manage',
      'roles:read',
      'roles:manage',
      'roles:assign',
    ],
  },
  {
    name: 'principal',
    description:
      'Runs academics and students; reads settings, HR and finance summaries',
    scope: 'school',
    permissions: [
      'domains:read',
      'academic_years:read',
      'classes:read',
      'sections:read',
      'subjects:read',
      'subject_groups:read',
      'class_subjects:read',
      'class_subject_groups:read',
      'class_teachers:read',
      'subject_teachers:read',
      'academic_years:create',
      'academic_years:update',
      'classes:create',
      'classes:update',
      'sections:create',
      'sections:update',
      'subjects:create',
      'subjects:update',
      'subject_groups:create',
      'subject_groups:update',
      'class_subjects:create',
      'class_subjects:update',
      'class_subject_groups:create',
      'class_subject_groups:update',
      'class_teachers:create',
      'class_teachers:update',
      'subject_teachers:create',
      'subject_teachers:update',
      'students:read',
      'students:create',
      'students:update',
      'student_documents:read',
      'student_documents:create',
      'student_documents:update',
      'student_medical:read',
      'student_medical:create',
      'student_medical:update',
      'student_notes:read',
      'student_notes:create',
      'student_notes:update',
      'guardians:read',
      'guardians:create',
      'guardians:update',
      'enrollments:read',
      'enrollments:create',
      'enrollments:update',
      'student_subjects:read',
      'student_subjects:create',
      'promotions:read',
      'promotions:create',
      'departments:read',
      'designations:read',
      'employees:read',
    ],
  },
  {
    name: 'accountant',
    description: 'Fees and finance; reads students and staff',
    scope: 'school',
    permissions: [
      'academic_years:read',
      'classes:read',
      'sections:read',
      'students:read',
      'enrollments:read',
      'student_subjects:read',
      'guardians:read',
      'departments:read',
      'designations:read',
      'employees:read',
    ],
  },
  {
    name: 'teacher',
    description: 'Teaching staff, limited to the sections and subjects taught',
    scope: 'assigned',
    permissions: [
      'academic_years:read',
      'classes:read',
      'sections:read',
      'subjects:read',
      'subject_groups:read',
      'class_subjects:read',
      'class_subject_groups:read',
      'class_teachers:read',
      'subject_teachers:read',
      'students:read',
      'enrollments:read',
      'student_subjects:read',
      'student_documents:read',
      'student_notes:read',
      'guardians:read',
    ],
  },
  {
    name: 'class_teacher',
    description: 'Teacher who also manages the students of their own section',
    scope: 'assigned',
    permissions: [
      'academic_years:read',
      'classes:read',
      'sections:read',
      'subjects:read',
      'subject_groups:read',
      'class_subjects:read',
      'class_subject_groups:read',
      'class_teachers:read',
      'subject_teachers:read',
      'students:read',
      'enrollments:read',
      'student_subjects:read',
      'students:update',
      'student_documents:read',
      'student_documents:create',
      'student_documents:update',
      'student_medical:read',
      'student_notes:read',
      'student_notes:create',
      'student_notes:update',
      'guardians:read',
      'guardians:update',
    ],
  },
  {
    name: 'receptionist',
    description: 'Front desk: admissions, student records and fee collection',
    scope: 'school',
    permissions: [
      'academic_years:read',
      'classes:read',
      'sections:read',
      'students:read',
      'enrollments:read',
      'student_subjects:read',
      'students:create',
      'student_documents:read',
      'student_documents:create',
      'guardians:read',
      'guardians:create',
      'guardians:update',
      'enrollments:create',
    ],
  },
  {
    name: 'librarian',
    description: 'Library management; reads students',
    scope: 'school',
    permissions: [
      'academic_years:read',
      'classes:read',
      'sections:read',
      'students:read',
      'enrollments:read',
      'student_subjects:read',
    ],
  },
  {
    name: 'committee_member',
    description:
      'Managing committee: read-only settings, academic setup and reports',
    scope: 'school',
    permissions: [
      'domains:read',
      'academic_years:read',
      'classes:read',
      'sections:read',
      'subjects:read',
      'subject_groups:read',
      'class_subjects:read',
      'class_subject_groups:read',
      'class_teachers:read',
      'subject_teachers:read',
    ],
  },
  {
    name: 'student',
    description: 'Student (portal only)',
    scope: 'school',
    permissions: ['portal:access'],
  },
  {
    name: 'guardian',
    description: 'Parent or guardian (portal only)',
    scope: 'school',
    permissions: ['portal:access'],
  },
];

const NEW_ROLE_NAMES = [
  'principal',
  'class_teacher',
  'receptionist',
  'committee_member',
  'guardian',
];

export class AlignSystemRoles1792330000004 implements MigrationInterface {
  name = 'AlignSystemRoles1792330000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."roles_scope_enum" AS ENUM('school', 'assigned')`,
    );
    await queryRunner.query(
      `ALTER TABLE "roles" ADD "scope" "public"."roles_scope_enum" NOT NULL DEFAULT 'school'`,
    );

    // Free the new system names from custom roles that already use them.
    const clashes = (await queryRunner.query(
      `SELECT "id", "org_id", "name" FROM "roles" WHERE NOT "is_system" AND "name" = ANY($1)`,
      [NEW_ROLE_NAMES],
    )) as { id: string; org_id: string; name: string }[];
    for (const role of clashes) {
      await this.renameToFreeName(queryRunner, role.id, role.org_id, role.name);
    }
    await queryRunner.query(
      `UPDATE "roles" SET "name" = 'guardian' WHERE "is_system" AND "name" = 'parent'`,
    );

    for (const role of ROLES) {
      await queryRunner.query(
        `INSERT INTO "roles" ("org_id", "name", "description", "permissions", "scope", "is_system")
         SELECT "id", $1, $2, $3, $4::"public"."roles_scope_enum", true FROM "organizations"
         ON CONFLICT ("org_id", "name") DO NOTHING`,
        [role.name, role.description, role.permissions, role.scope],
      );
      await queryRunner.query(
        `UPDATE "roles" SET "description" = $2, "permissions" = $3, "scope" = $4::"public"."roles_scope_enum", "updated_at" = now()
         WHERE "is_system" AND "name" = $1`,
        [role.name, role.description, role.permissions, role.scope],
      );
    }

    await this.moveHolders(queryRunner, 'staff', 'principal');
    await queryRunner.query(
      `DELETE FROM "roles" WHERE "is_system" AND "name" = 'staff'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "roles" r SET "name" = 'parent'
       WHERE r."is_system" AND r."name" = 'guardian'
         AND NOT EXISTS (SELECT 1 FROM "roles" o WHERE o."org_id" = r."org_id" AND o."name" = 'parent')`,
    );
    await queryRunner.query(`ALTER TABLE "roles" DROP COLUMN "scope"`);
    await queryRunner.query(`DROP TYPE "public"."roles_scope_enum"`);
  }

  /**
   * Renames a custom role to "<name> (custom)", or the first free
   * "<name> (custom N)", so `uq_roles_org_name` holds.
   */
  private async renameToFreeName(
    queryRunner: QueryRunner,
    id: string,
    orgId: string,
    name: string,
  ): Promise<void> {
    for (let n = 1; ; n++) {
      const candidate = n === 1 ? `${name} (custom)` : `${name} (custom ${n})`;
      const taken = (await queryRunner.query(
        `SELECT 1 FROM "roles" WHERE "org_id" = $1 AND "name" = $2`,
        [orgId, candidate],
      )) as unknown[];
      if (taken.length === 0) {
        await queryRunner.query(
          `UPDATE "roles" SET "name" = $2 WHERE "id" = $1`,
          [id, candidate],
        );
        return;
      }
    }
  }

  /** Gives every holder of system role `from` the system role `to` as well. */
  private async moveHolders(
    queryRunner: QueryRunner,
    from: string,
    to: string,
  ): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "user_roles" ("org_id", "user_id", "role_id")
       SELECT ur."org_id", ur."user_id", target."id"
       FROM "user_roles" ur
       JOIN "roles" source ON source."id" = ur."role_id" AND source."is_system" AND source."name" = $1
       JOIN "roles" target ON target."org_id" = ur."org_id" AND target."is_system" AND target."name" = $2
       ON CONFLICT DO NOTHING`,
      [from, to],
    );
  }
}
