import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tracks when a verified custom domain's DNS records started failing, so the
 * periodic check can mark it inactive after a grace period instead of on the
 * first failed lookup.
 */
export class DomainDnsFailingSince1792321369676 implements MigrationInterface {
  name = 'DomainDnsFailingSince1792321369676';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organization_domains" ADD "dns_failing_since" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organization_domains" DROP COLUMN "dns_failing_since"`,
    );
  }
}
