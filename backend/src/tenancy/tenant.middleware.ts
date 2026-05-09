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

export interface RequestWithTenant extends Request {
  tenantId?: string;
  tenantSchema?: string;
  tenantSlug?: string;
}

interface CachedTenant {
  id: string;
  slug: string;
  schemaName: string;
  status: string;
  expiresAt: number;
}

const SLUG_PATTERN = /^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$/;
const CACHE_TTL_MS = 60_000; // 1 minute

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private static cache = new Map<string, CachedTenant>();

  constructor(private tenantService: TenantService) {}

  /** Clear a specific slug from cache, or all entries if no slug given. */
  static invalidateCache(slug?: string): void {
    if (slug) {
      TenantMiddleware.cache.delete(slug);
    } else {
      TenantMiddleware.cache.clear();
    }
  }

  async use(req: RequestWithTenant, res: Response, next: NextFunction) {
    const slug = this.extractSlug(req);

    if (!slug) {
      throw new TenantContextMissingException();
    }

    if (!SLUG_PATTERN.test(slug)) {
      throw new TenantNotFoundException(slug);
    }

    const cached = TenantMiddleware.cache.get(slug);
    if (cached && cached.expiresAt > Date.now()) {
      if (cached.status !== TenantStatus.ACTIVE) {
        throw new TenantInactiveException(slug);
      }
      req.tenantId = cached.id;
      req.tenantSlug = cached.slug;
      req.tenantSchema = cached.schemaName;
      return next();
    }

    const tenant = await this.tenantService.findBySlug(slug);

    if (!tenant) {
      throw new TenantNotFoundException(slug);
    }

    TenantMiddleware.cache.set(slug, {
      id: tenant.id,
      slug: tenant.slug,
      schemaName: tenant.schemaName,
      status: tenant.status,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    if (tenant.status !== TenantStatus.ACTIVE) {
      throw new TenantInactiveException(slug);
    }

    req.tenantId = tenant.id;
    req.tenantSlug = tenant.slug;
    req.tenantSchema = tenant.schemaName;
    next();
  }

  private extractSlug(req: Request): string | null {
    const tenantSlug = req.headers[Key.TenantKeyHeader.toLowerCase()] as string;
    if (tenantSlug) return tenantSlug;

    // Prefer Express' parsed hostname (already strips port); fall back to host header.
    const rawHost = (req.hostname || req.headers.host || '').toString();
    const host = rawHost.split(':')[0]; // defensive: strip port if present
    const subdomain = host.split('.')[0];

    if (!['www', 'api'].includes(subdomain)) {
      return subdomain;
    }

    return null;
  }
}
