import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { Key } from '~/common/enums/keys.enum';
import { OrganizationStatus } from '~/modules/organizations/enums/organization-status.enum';
import { OrganizationService } from '~/modules/organizations/services/organization.service';
import {
  TenantContextMissingException,
  TenantInactiveException,
  TenantNotFoundException,
} from './exceptions/tenant.exceptions';
import {
  TENANT_SLUG_CACHE_TTL_MS,
  tenantDomainCache,
  tenantSlugCache,
} from './tenant-slug.cache';

/** Request after `TenantMiddleware` has resolved the organization (school). */
export interface RequestWithOrg extends Request {
  orgId?: string;
  orgSlug?: string;
}

interface ResolvedOrg {
  id: string;
  slug: string;
  status: OrganizationStatus;
}

const SLUG_PATTERN = /^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$/;

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private organizationService: OrganizationService) {}

  async use(req: RequestWithOrg, res: Response, next: NextFunction) {
    const resolved = await this.resolve(req);

    if (!resolved) {
      throw new TenantContextMissingException();
    }

    if (resolved.status !== OrganizationStatus.ACTIVE) {
      throw new TenantInactiveException(resolved.slug);
    }

    req.orgId = resolved.id;
    req.orgSlug = resolved.slug;
    next();
  }

  /**
   * Resolution order:
   *  1. `x-tenant-id` header (the slug the frontend forwards) — explicit, so a
   *     miss is a hard error.
   *  2. Subdomain label (managed `acme.mydomain.com`) → lookup by slug.
   *  3. Full host (custom/vanity domain `app.acmeschool.com`) → lookup by domain.
   */
  private async resolve(req: Request): Promise<ResolvedOrg | null> {
    const headerSlug = (
      req.headers[Key.TenantKeyHeader.toLowerCase()] as string | undefined
    )?.trim();
    if (headerSlug) {
      const bySlug = await this.bySlug(headerSlug);
      if (!bySlug) throw new TenantNotFoundException(headerSlug);
      return bySlug;
    }

    const host = (req.hostname || req.headers.host || '')
      .toString()
      .split(':')[0]
      .toLowerCase();

    const subdomain = host.split('.')[0];
    if (subdomain && !['www', 'api'].includes(subdomain)) {
      const bySlug = await this.bySlug(subdomain);
      if (bySlug) return bySlug;
    }

    return this.byDomain(host);
  }

  /** Slug lookup with cache. Returns null on invalid pattern / not found. */
  private async bySlug(slug: string): Promise<ResolvedOrg | null> {
    if (!SLUG_PATTERN.test(slug)) return null;

    const cached = tenantSlugCache.get(slug);
    if (cached && cached.expiresAt > Date.now()) {
      return cached;
    }

    const org = await this.organizationService.findBySlug(slug);
    if (!org) return null;

    tenantSlugCache.set(slug, {
      id: org.id,
      slug: org.slug,
      status: org.status,
      expiresAt: Date.now() + TENANT_SLUG_CACHE_TTL_MS,
    });
    return org;
  }

  /** Custom-domain (full host) lookup with cache. */
  private async byDomain(host: string): Promise<ResolvedOrg | null> {
    // Only hosts that look like a domain can match the `domain` column.
    if (!host || !host.includes('.')) return null;

    const cached = tenantDomainCache.get(host);
    if (cached && cached.expiresAt > Date.now()) {
      return cached;
    }

    const org = await this.organizationService.findByDomain(host);
    if (!org) return null;

    tenantDomainCache.set(host, {
      id: org.id,
      slug: org.slug,
      status: org.status,
      expiresAt: Date.now() + TENANT_SLUG_CACHE_TTL_MS,
    });
    return org;
  }
}
