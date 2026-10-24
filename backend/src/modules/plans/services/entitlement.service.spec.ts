import { ForbiddenException } from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';
import type { Organization } from '~/modules/organizations/entities/organization.entity';
import { OrganizationStatus } from '~/modules/organizations/enums/organization-status.enum';
import type { Plan } from '../entities/plan.entity';
import { DEFAULT_PLANS, PlanCode, PLAN_MODULES } from '../plans.catalog';
import { EntitlementService } from './entitlement.service';

const DAY = 24 * 60 * 60 * 1000;

const plans: Plan[] = DEFAULT_PLANS.map(
  (p) => ({ ...p, id: `plan-${p.code}` }) as unknown as Plan,
);
const plan = (code: PlanCode) =>
  plans.find((p) => p.code === (code as string))!;

describe('EntitlementService', () => {
  let org: Partial<Organization>;
  let usage: number;
  let service: EntitlementService;

  beforeEach(() => {
    org = {
      id: 'org-1',
      status: OrganizationStatus.ACTIVE,
      plan: plan(PlanCode.BASIC),
      trialEndsAt: null,
      addOnModules: [],
      limitOverrides: null,
    };
    usage = 0;
    const organizations = {
      findOne: jest.fn(() => Promise.resolve(org)),
    } as unknown as Repository<Organization>;
    const planRepo = {
      findOne: jest.fn(({ where }: { where: { code: string } }) =>
        Promise.resolve(plans.find((p) => p.code === where.code) ?? null),
      ),
    } as unknown as Repository<Plan>;
    const dataSource = {
      query: jest.fn(() => Promise.resolve([{ n: String(usage) }])),
    } as unknown as DataSource;
    service = new EntitlementService(organizations, planRepo, dataSource);
  });

  it("grants the plan's modules and add-ons", async () => {
    org.addOnModules = [PLAN_MODULES.TRANSPORT];
    const e = await service.get('org-1');
    expect(e.planCode).toBe(PlanCode.BASIC);
    expect(e.modules.has(PLAN_MODULES.FEES)).toBe(true);
    expect(e.modules.has(PLAN_MODULES.CUSTOM_DOMAIN)).toBe(false);
    expect(e.modules.has(PLAN_MODULES.TRANSPORT)).toBe(true);
  });

  it('treats a school without a plan as Free', async () => {
    org.plan = null;
    const e = await service.get('org-1');
    expect(e.planCode).toBe(PlanCode.FREE);
    expect(e.limits.students).toBe(100);
    await expect(
      service.assertModule('org-1', PLAN_MODULES.FEES),
    ).rejects.toThrow(ForbiddenException);
  });

  it('grants Standard during a running trial, and the own plan after it', async () => {
    org.plan = plan(PlanCode.FREE);
    org.status = OrganizationStatus.TRIAL;
    org.trialEndsAt = new Date(Date.now() + 5 * DAY);
    const onTrial = await service.get('org-1');
    expect(onTrial.onTrial).toBe(true);
    expect(onTrial.effectivePlanCode).toBe(PlanCode.STANDARD);
    expect(onTrial.modules.has(PLAN_MODULES.CUSTOM_DOMAIN)).toBe(true);

    service.invalidate('org-1');
    org.trialEndsAt = new Date(Date.now() - DAY);
    const expired = await service.get('org-1');
    expect(expired.onTrial).toBe(false);
    expect(expired.effectivePlanCode).toBe(PlanCode.FREE);
  });

  it('summarizes the plan as JSON, modules sorted', async () => {
    org.plan = plan(PlanCode.FREE);
    org.status = OrganizationStatus.TRIAL;
    org.trialEndsAt = new Date(Date.now() + 5 * DAY);
    org.addOnModules = [PLAN_MODULES.TRANSPORT];

    const summary = await service.summary('org-1');

    expect(summary).toMatchObject({
      code: PlanCode.FREE,
      effectiveCode: PlanCode.STANDARD,
      onTrial: true,
      trialEndsAt: org.trialEndsAt,
    });
    expect(summary.modules).toEqual(
      [
        ...new Set([
          ...plan(PlanCode.STANDARD).modules,
          PLAN_MODULES.TRANSPORT,
        ]),
      ].sort(),
    );
    expect(Object.keys(summary.limits).sort()).toEqual([
      'admins',
      'storageMb',
      'students',
      'users',
    ]);
  });

  it('never lowers a higher plan during a trial', async () => {
    org.plan = plan(PlanCode.PREMIUM);
    org.status = OrganizationStatus.TRIAL;
    org.trialEndsAt = new Date(Date.now() + DAY);
    expect((await service.get('org-1')).effectivePlanCode).toBe(
      PlanCode.PREMIUM,
    );
  });

  it('applies per-school limit overrides (null = unlimited)', async () => {
    org.plan = plan(PlanCode.FREE);
    org.limitOverrides = { students: 250, admins: null };
    const e = await service.get('org-1');
    expect(e.limits).toMatchObject({
      students: 250,
      admins: null,
      storageMb: 500,
    });
  });

  it('refuses past a limit with PLAN_LIMIT_REACHED', async () => {
    org.plan = plan(PlanCode.FREE);
    usage = 99;
    await expect(
      service.assertLimit('org-1', 'students'),
    ).resolves.toBeUndefined();
    usage = 100;
    await expect(service.assertLimit('org-1', 'students')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('measures storage in bytes against a limit in MB', async () => {
    org.plan = plan(PlanCode.FREE); // 500 MB
    usage = 499 * 1024 * 1024;
    await expect(
      service.assertLimit('org-1', 'storageMb', 512 * 1024),
    ).resolves.toBeUndefined();
    await expect(
      service.assertLimit('org-1', 'storageMb', 2 * 1024 * 1024),
    ).rejects.toMatchObject({
      response: { code: 'PLAN_LIMIT_REACHED', limit: 'storageMb' },
    });
  });

  it('caches per school until invalidated', async () => {
    await service.get('org-1');
    org.plan = plan(PlanCode.PREMIUM);
    expect((await service.get('org-1')).planCode).toBe(PlanCode.BASIC);
    service.invalidate('org-1');
    expect((await service.get('org-1')).planCode).toBe(PlanCode.PREMIUM);
  });
});
