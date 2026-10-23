import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Organization } from '~/modules/organizations/entities/organization.entity';
import { OrganizationStatus } from '~/modules/organizations/enums/organization-status.enum';
import { Plan } from '../entities/plan.entity';
import {
  PlanCode,
  type PlanLimitKey,
  type PlanLimits,
  type PlanModule,
  TRIAL_PLAN,
} from '../plans.catalog';

/** What a school may use right now. */
export interface Entitlements {
  orgId: string;
  /** The plan the school is on (`free` when none is assigned). */
  planCode: string;
  /** The plan whose modules and limits apply (Standard during a trial). */
  effectivePlanCode: string;
  onTrial: boolean;
  trialEndsAt: Date | null;
  modules: ReadonlySet<string>;
  limits: PlanLimits;
}

const CACHE_TTL_MS = 60_000;
const MB = 1024 * 1024;

/**
 * Plan entitlements per school (PRD 3.3, 6.1): modules and limits from the
 * school's plan, its add-on modules and per-school limit overrides. A
 * running trial grants the trial plan (Standard) when that is more than the
 * school's own plan; an expired trial falls back to the school's plan
 * (Free when none is assigned), since billing arrives in Phase 1b.
 *
 * Singleton on the root connection, so it works from requests, jobs and
 * schedulers alike. Cached in memory per school for 60 s; platform changes
 * call `invalidate`. Usage counts bypass RLS and count committed rows only,
 * so a limit can be overshot by concurrent requests (soft limit).
 */
@Injectable()
export class EntitlementService {
  private readonly cache = new Map<
    string,
    { value: Entitlements; expiresAt: number }
  >();

  constructor(
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
    @InjectRepository(Plan)
    private readonly plans: Repository<Plan>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async get(orgId: string): Promise<Entitlements> {
    const cached = this.cache.get(orgId);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const org = await this.organizations.findOne({
      where: { id: orgId },
      relations: { plan: true },
    });
    if (!org) {
      throw new ForbiddenException({
        message: 'Unknown organization',
        code: 'MODULE_NOT_IN_PLAN',
      });
    }
    const value = await this.compute(org);
    this.cache.set(orgId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  }

  invalidate(orgId?: string): void {
    if (orgId) this.cache.delete(orgId);
    else this.cache.clear();
  }

  async hasModule(orgId: string, module: PlanModule): Promise<boolean> {
    return (await this.get(orgId)).modules.has(module);
  }

  async assertModule(orgId: string, module: PlanModule): Promise<void> {
    if (!(await this.hasModule(orgId, module))) {
      throw new ForbiddenException({
        message: "This feature isn't included in your school's plan",
        code: 'MODULE_NOT_IN_PLAN',
        module,
      });
    }
  }

  /**
   * Refuses (403 `PLAN_LIMIT_REACHED`) when adding `delta` would take the
   * school past its limit. `storageMb` takes the delta in bytes.
   */
  async assertLimit(
    orgId: string,
    key: PlanLimitKey,
    delta = 1,
  ): Promise<void> {
    const limit = (await this.get(orgId)).limits[key];
    if (limit === null || limit === undefined) return;
    const used = await this.usage(orgId, key);
    const adding = key === 'storageMb' ? delta / MB : delta;
    if (used + adding > limit) {
      throw new ForbiddenException({
        message: `Your school's plan allows ${limit}${key === 'storageMb' ? ' MB of storage' : ` ${LIMIT_NOUNS[key]}`}`,
        code: 'PLAN_LIMIT_REACHED',
        limit: key,
      });
    }
  }

  /** Current use of a limit (`storageMb` in MB). */
  async usage(orgId: string, key: PlanLimitKey): Promise<number> {
    const rows: { n: string | number | null }[] = await this.dataSource.query(
      USAGE_SQL[key],
      [orgId],
    );
    const n = Number(rows[0]?.n ?? 0);
    return key === 'storageMb' ? n / MB : n;
  }

  private async compute(org: Organization): Promise<Entitlements> {
    const own =
      org.plan ??
      (await this.plans.findOne({ where: { code: PlanCode.FREE } }));
    const onTrial =
      org.status === OrganizationStatus.TRIAL &&
      !!org.trialEndsAt &&
      org.trialEndsAt.getTime() > Date.now();

    let effective = own;
    if (onTrial) {
      const trial = await this.plans.findOne({ where: { code: TRIAL_PLAN } });
      if (trial && (!own || trial.sortOrder > own.sortOrder)) {
        effective = trial;
      }
    }

    const limits: PlanLimits = {
      students: null,
      storageMb: null,
      users: null,
      admins: null,
      ...(effective?.limits ?? {}),
      ...(org.limitOverrides ?? {}),
    };
    return {
      orgId: org.id,
      planCode: own?.code ?? PlanCode.FREE,
      effectivePlanCode: effective?.code ?? PlanCode.FREE,
      onTrial,
      trialEndsAt: org.trialEndsAt,
      modules: new Set([
        ...(effective?.modules ?? []),
        ...(org.addOnModules ?? []),
      ]),
      limits,
    };
  }
}

const LIMIT_NOUNS: Record<PlanLimitKey, string> = {
  students: 'active students',
  storageMb: 'MB of storage',
  users: 'members',
  admins: 'school admins',
};

/** Root connection (no RLS), so every query filters on `org_id` itself. */
const USAGE_SQL: Record<PlanLimitKey, string> = {
  students: `SELECT count(*) AS n FROM "students"
             WHERE "org_id" = $1 AND "status" = 'active' AND "deleted_at" IS NULL`,
  storageMb: `SELECT coalesce(sum("size"), 0) AS n FROM "files" WHERE "org_id" = $1`,
  users: `SELECT count(*) AS n FROM "memberships"
          WHERE "org_id" = $1 AND "status" IN ('active', 'pending')`,
  admins: `SELECT count(*) AS n FROM "memberships"
           WHERE "org_id" = $1 AND "is_admin" AND "status" IN ('active', 'pending')`,
};
