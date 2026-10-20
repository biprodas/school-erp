import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from 'src/app.module';
import { configureApp } from 'src/app.setup';
import { NumberingService } from '~/modules/numbering/numbering.service';
import { Organization } from '~/modules/organizations/entities/organization.entity';
import { OrganizationStatus } from '~/modules/organizations/enums/organization-status.enum';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import type { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { TenantJobRunner } from '~/tenancy/tenant-job.runner';

class Rollback extends Error {}

/**
 * NumberingService (plan 4.2) against a real Postgres: concurrent callers
 * get distinct, gap-free numbers, a rollback never burns one, and every
 * school counts on its own.
 */
describe('Numbering (e2e)', () => {
  let app: INestApplication<App>;
  let rootDs: DataSource;
  let runner: TenantJobRunner;

  const runId = randomUUID().slice(0, 8);
  let orgA: Organization;
  let orgB: Organization;

  /**
   * One `next()` in its own tenant connection and transaction, like a
   * request that inserts a receipt. `rollback` makes the transaction fail
   * after taking the number.
   */
  const takeNumber = (
    org: Organization,
    key: string,
    scope: string,
    { rollback = false } = {},
  ): Promise<number> =>
    runner.run(org.id, async (resolve) => {
      const ds = await resolve<TenantDataSourceProxy>(TENANT_DATASOURCE);
      const numbering = await resolve(NumberingService);
      return ds.runInTransaction(async () => {
        const value = await numbering.next(key, scope);
        // Hold the row lock a moment so concurrent callers really overlap.
        await ds.getManager().query('SELECT pg_sleep(0.01)');
        if (rollback) throw new Rollback(`rolled back ${value}`);
        return value;
      });
    });

  const storedNextValue = async (org: Organization, key: string) => {
    const rows = await rootDs.query<{ next_value: string }[]>(
      `SELECT next_value FROM numbering_sequences
       WHERE org_id = $1 AND key = $2 AND scope = ''`,
      [org.id, key],
    );
    return rows.length ? Number(rows[0].next_value) : null;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    rootDs = app.get<DataSource>(getDataSourceToken());
    runner = app.get(TenantJobRunner);

    const orgs = rootDs.getRepository(Organization);
    [orgA, orgB] = await orgs.save(
      ['a', 'b'].map((x) =>
        orgs.create({
          name: `E2E Numbering ${x.toUpperCase()} ${runId}`,
          slug: `e2e-numbering-${x}-${runId}`,
          status: OrganizationStatus.ACTIVE,
        }),
      ),
    );
  });

  afterAll(async () => {
    // Deleting an organization cascades to its counters.
    if (rootDs?.isInitialized) {
      const ids = [orgA?.id, orgB?.id].filter(Boolean);
      if (ids.length) {
        await rootDs.getRepository(Organization).delete(ids);
      }
    }
    await app?.close();
  });

  it('gives 20 concurrent callers distinct, gap-free numbers', async () => {
    const values = await Promise.all(
      Array.from({ length: 20 }, () => takeNumber(orgA, 'receipt', '2026')),
    );

    expect([...values].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
  });

  it('keeps separate counters per scope', async () => {
    expect(await takeNumber(orgA, 'receipt', '2027')).toBe(1);
    expect(await takeNumber(orgA, 'receipt', '2026')).toBe(21);
  });

  it('does not burn a number when the transaction rolls back', async () => {
    expect(await takeNumber(orgA, 'invoice', '')).toBe(1);

    await expect(
      takeNumber(orgA, 'invoice', '', { rollback: true }),
    ).rejects.toThrow(Rollback);
    expect(await storedNextValue(orgA, 'invoice')).toBe(2);

    expect(await takeNumber(orgA, 'invoice', '')).toBe(2);
  });

  it('does not burn numbers when concurrent transactions roll back', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) =>
        takeNumber(orgA, 'certificate', '', { rollback: i % 2 === 1 }),
      ),
    );

    const kept = results
      .filter(
        (r): r is PromiseFulfilledResult<number> => r.status === 'fulfilled',
      )
      .map((r) => r.value)
      .sort((a, b) => a - b);
    expect(kept).toEqual([1, 2, 3, 4, 5]);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(5);
    expect(await storedNextValue(orgA, 'certificate')).toBe(6);
  });

  it('counts independently in every school [tenant-isolation]', async () => {
    const [a, b] = await Promise.all([
      takeNumber(orgA, 'student_id', ''),
      takeNumber(orgB, 'student_id', ''),
    ]);
    expect(a).toBe(1);
    expect(b).toBe(1);

    // Org B's 2026 receipts start at 1 although org A is already at 21.
    expect(await takeNumber(orgB, 'receipt', '2026')).toBe(1);
    expect(await takeNumber(orgA, 'receipt', '2026')).toBe(22);

    const rows = await rootDs.query<{ org_id: string; next_value: string }[]>(
      `SELECT org_id, next_value FROM numbering_sequences
       WHERE key = 'student_id' AND org_id = ANY($1) ORDER BY org_id`,
      [[orgA.id, orgB.id]],
    );
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.next_value === '2')).toBe(true);
  });
});
