import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { RequestWithOrg } from '~/tenancy/tenant.middleware';

type AuthedRequest = RequestWithOrg & {
  user?: { id?: string; userId?: string };
};

/**
 * Tenant-aware throttler.
 *
 * The default `ThrottlerGuard` tracks purely by IP, which lets one tenant's
 * traffic eat into another's budget behind a shared proxy and lets a single
 * authenticated user dodge limits by rotating IPs. We instead key on:
 *
 *   - `tenant:u:<userId>`  when a user is authenticated, else
 *   - `tenant:ip:<ip>`     for anonymous / pre-auth traffic (e.g. login).
 *
 * The tenant segment (`req.orgId`, set by `TenantMiddleware`, which runs
 * before guards) isolates each tenant's window; `public` covers platform and
 * tenant-less routes.
 */
@Injectable()
export class TenantThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: AuthedRequest): Promise<string> {
    const tenant = req.orgId ?? 'public';

    const userId = req.user?.id ?? req.user?.userId;
    if (userId) {
      return Promise.resolve(`${tenant}:u:${userId}`);
    }

    // `req.ip` follows X-Forwarded-For only through trusted proxies, so a
    // client can't dodge the limit by sending a new address each time.
    const ip = req.ip || 'unknown';
    return Promise.resolve(`${tenant}:ip:${ip}`);
  }
}
