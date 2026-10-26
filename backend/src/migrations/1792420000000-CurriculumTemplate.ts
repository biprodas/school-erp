import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `organizations.curriculum_template`: the one curriculum template a
 * school uses (onboarding). Schools that applied one already get it from
 * their audit log, the latest when they applied more than one.
 */
export class CurriculumTemplate1792420000000 implements MigrationInterface {
  name = 'CurriculumTemplate1792420000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organizations" ADD "curriculum_template" character varying(40)`,
    );
    await queryRunner.query(
      `UPDATE "organizations" o SET "curriculum_template" = (
         SELECT a."entity_id" FROM "audit_logs" a
         WHERE a."org_id" = o."id"
           AND a."action" = 'onboarding.template_applied'
           AND a."entity_type" = 'template'
           AND a."entity_id" IN ('nctb', 'cambridge', 'alia-madrasa')
         ORDER BY a."created_at" DESC, a."seq" DESC
         LIMIT 1
       )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organizations" DROP COLUMN "curriculum_template"`,
    );
  }
}
