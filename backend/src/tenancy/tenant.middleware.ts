import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { Key } from '~/common/enums/keys.enum';
import { TenantStatus } from 'src/modules/platform/tenants/enums/tenant-status.enum';
import { TenantService } from 'src/modules/platform/tenants/services/tenant.service';
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

export interface RequestWithTenant extends Request {
  tenantId?: string;
  tenantSchema?: string;
  tenantSlug?: string;
}

interface ResolvedTenant {
  id: string;
  slug: string;
  schemaName: string;
  status: string;
}

const SLUG_PATTERN = /^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$/;

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private tenantService: TenantService) {}

  async use(req: RequestWithTenant, res: Response, next: NextFunction) {
    const resolved = await this.resolve(req);

    if (!resolved) {
      throw new TenantContextMissingException();
    }

    if (resolved.status !== TenantStatus.ACTIVE) {
      throw new TenantInactiveException(resolved.slug);
    }

    req.tenantId = resolved.id;
    req.tenantSlug = resolved.slug;
    req.tenantSchema = resolved.schemaName;
    next();
  }

  /**
   * Resolution order:
   *  1. `x-tenant-id` header (the slug the frontend forwards) — explicit, so a
   *     miss is a hard error.
   *  2. Subdomain label (managed `acme.mydomain.com`) → lookup by slug.
   *  3. Full host (custom/vanity domain `app.acmeschool.com`) → lookup by domain.
   */
  private async resolve(req: Request): Promise<ResolvedTenant | null> {
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
  private async bySlug(slug: string): Promise<ResolvedTenant | null> {
    if (!SLUG_PATTERN.test(slug)) return null;

    const cached = tenantSlugCache.get(slug);
    if (cached && cached.expiresAt > Date.now()) {
      return cached;
    }

    const tenant = await this.tenantService.findBySlug(slug);
    if (!tenant) return null;

    tenantSlugCache.set(slug, {
      id: tenant.id,
      slug: tenant.slug,
      schemaName: tenant.schemaName,
      status: tenant.status,
      expiresAt: Date.now() + TENANT_SLUG_CACHE_TTL_MS,
    });
    return tenant;
  }

  /** Custom-domain (full host) lookup with cache. */
  private async byDomain(host: string): Promise<ResolvedTenant | null> {
    // Only hosts that look like a domain can match the `domain` column.
    if (!host || !host.includes('.')) return null;

    const cached = tenantDomainCache.get(host);
    if (cached && cached.expiresAt > Date.now()) {
      return cached;
    }

    const tenant = await this.tenantService.findByDomain(host);
    if (!tenant) return null;

    tenantDomainCache.set(host, {
      id: tenant.id,
      slug: tenant.slug,
      schemaName: tenant.schemaName,
      status: tenant.status,
      expiresAt: Date.now() + TENANT_SLUG_CACHE_TTL_MS,
    });
    return tenant;
  }
}
