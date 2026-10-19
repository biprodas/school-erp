import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `GuardianRelation.BROTHER` was stored as 'BROTHER' while every other value
 * is lower-case. The enum now stores 'brother'; existing rows follow.
 */
export class GuardianRelationLowercase1792330000001 implements MigrationInterface {
  name = 'GuardianRelationLowercase1792330000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "student_guardians" SET "relation" = 'brother' WHERE "relation" = 'BROTHER'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "student_guardians" SET "relation" = 'BROTHER' WHERE "relation" = 'brother'`,
    );
  }
}
