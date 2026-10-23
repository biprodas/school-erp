import { DataSource } from 'typeorm';
import { Plan } from '~/modules/plans/entities/plan.entity';
import { PlanCode } from '~/modules/plans/plans.catalog';

/**
 * Id of a seeded plan (`PlanSeeder` inserts them on boot with DB_SYNC).
 * Fixtures that use plan-gated features (custom domains, custom roles) put
 * their schools on Standard; a school with no plan is on Free.
 */
export async function planId(
  ds: DataSource,
  code: PlanCode = PlanCode.STANDARD,
): Promise<string> {
  const plan = await ds.getRepository(Plan).findOneOrFail({ where: { code } });
  return plan.id;
}
