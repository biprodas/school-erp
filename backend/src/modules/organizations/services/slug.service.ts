import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, LessThanOrEqual, Repository } from 'typeorm';
import {
  isReservedSlug,
  isValidSlug,
  slugCandidates,
} from '~/shared/slug/reserved-slugs';
import { Organization } from '../entities/organization.entity';
import { OrganizationSlugHistory } from '../entities/organization-slug-history.entity';

/** How long an old slug redirects and stays blocked (12 months). */
export const SLUG_HISTORY_TTL_MS = 365 * 24 * 60 * 60 * 1000;

/** Minimum time between two renames of one school. */
export const SLUG_RENAME_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

export type SlugUnavailableReason = 'invalid' | 'reserved' | 'taken';

export interface SlugCheck {
  slug: string;
  available: boolean;
  reason?: SlugUnavailableReason;
  /** Up to three available alternatives when this one isn't. */
  suggestions: string[];
}

const ERROR_CODES: Record<SlugUnavailableReason, string> = {
  invalid: 'SLUG_INVALID',
  reserved: 'SLUG_RESERVED',
  taken: 'SLUG_TAKEN',
};

/**
 * Slug availability (doc/domains-and-routing.md, section 2). A slug is taken
 * while a school uses it or while it is in another school's slug history
 * (12 months after a rename). Reads the platform tables through the root
 * connection; pass the transaction's `manager` to check inside one.
 */
@Injectable()
export class SlugService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
    @InjectRepository(OrganizationSlugHistory)
    private readonly history: Repository<OrganizationSlugHistory>,
  ) {}

  async check(rawSlug: string): Promise<SlugCheck> {
    const slug = rawSlug.trim().toLowerCase();
    const reason = await this.unavailableReason(slug);
    if (!reason) return { slug, available: true, suggestions: [] };
    return {
      slug,
      available: false,
      reason,
      suggestions: await this.suggest(slug),
    };
  }

  /** Up to `count` available slugs derived from `base` (a slug or a name). */
  async suggest(base: string, count = 3): Promise<string[]> {
    const candidates = slugCandidates(base).filter((s) => s !== base);
    if (!candidates.length) return [];
    const taken = await this.taken(candidates);
    return candidates.filter((s) => !taken.has(s)).slice(0, count);
  }

  /**
   * Throws 409 (`SLUG_INVALID`, `SLUG_RESERVED` or `SLUG_TAKEN`, with
   * suggestions) unless `slug` can be claimed. `forOrgId` may reclaim its
   * own old slugs.
   */
  async assertAvailable(
    slug: string,
    manager?: EntityManager,
    forOrgId?: string,
  ): Promise<void> {
    const reason = await this.unavailableReason(slug, manager, forOrgId);
    if (!reason) return;
    throw new ConflictException({
      message:
        reason === 'taken'
          ? 'This address is already taken'
          : 'This address is not allowed',
      code: ERROR_CODES[reason],
      suggestions: await this.suggest(slug),
    });
  }

  /** The school an old (unexpired) slug of it now redirects to. */
  async findRedirect(slug: string): Promise<Organization | null> {
    const row = await this.history
      .createQueryBuilder('h')
      .innerJoinAndSelect('h.org', 'org')
      .where('h.slug = :slug AND h.expiresAt > now()', { slug })
      .getOne();
    return row?.org ?? null;
  }

  /**
   * Prepares a claim of `slug` by `orgId` inside its transaction: removes
   * an expired history row of any school and the school's own old row, so
   * the unique index doesn't block it.
   */
  async releaseForClaim(
    manager: EntityManager,
    slug: string,
    orgId?: string,
  ): Promise<void> {
    const repo = manager.getRepository(OrganizationSlugHistory);
    await repo.delete({ slug, expiresAt: LessThanOrEqual(new Date()) });
    if (orgId) await repo.delete({ slug, orgId });
  }

  private async unavailableReason(
    slug: string,
    manager?: EntityManager,
    forOrgId?: string,
  ): Promise<SlugUnavailableReason | null> {
    if (!isValidSlug(slug)) return 'invalid';
    if (isReservedSlug(slug)) return 'reserved';
    const taken = await this.taken([slug], manager, forOrgId);
    return taken.has(slug) ? 'taken' : null;
  }

  private async taken(
    slugs: string[],
    manager?: EntityManager,
    forOrgId?: string,
  ): Promise<Set<string>> {
    const orgs = manager?.getRepository(Organization) ?? this.organizations;
    const history =
      manager?.getRepository(OrganizationSlugHistory) ?? this.history;
    const [current, old] = await Promise.all([
      orgs.find({ where: { slug: In(slugs) }, select: { slug: true } }),
      history
        .createQueryBuilder('h')
        .select(['h.slug', 'h.orgId'])
        .where('h.slug IN (:...slugs) AND h.expiresAt > now()', { slugs })
        .getMany(),
    ]);
    return new Set([
      ...current.map((o) => o.slug),
      ...old.filter((h) => h.orgId !== forOrgId).map((h) => h.slug),
    ]);
  }
}
