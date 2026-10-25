import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { CLS_REQ, ClsService } from 'nestjs-cls';
import { clientInfoOf } from '~/common/decorators/client.decorator';
import { Key } from '~/common/enums/keys.enum';
import type { PlatformRole } from '~/modules/users/enums/platform-role.enum';
import type { RequestWithOrg } from '~/tenancy/tenant.middleware';

/** Who is acting and from where, for the current request or job. */
export interface RequestContextSnapshot {
  orgId: string | null;
  userId: string | null;
  isAdmin: boolean;
  /** Platform tokens only: the signed-in platform user's role. */
  platformRole: PlatformRole | null;
  sessionId: string | null;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
}

const EMPTY: RequestContextSnapshot = {
  orgId: null,
  userId: null,
  isAdmin: false,
  platformRole: null,
  sessionId: null,
  ip: null,
  userAgent: null,
  requestId: null,
};

/**
 * Reads the current request from the CLS context (`nestjs-cls`), so
 * singletons such as `PlatformAuditService` can see the actor, IP and
 * request id without being request-scoped. HTTP requests get a context from
 * the CLS middleware; `TenantJobRunner` opens one around each job with its
 * synthetic request. Outside both (scripts, plain unit tests) everything is
 * null. The user is read at call time, so it reflects the auth guards.
 */
@Injectable()
export class RequestContext {
  constructor(private readonly cls: ClsService) {}

  current(): RequestContextSnapshot {
    const req = this.cls.isActive()
      ? this.cls.get<Request | undefined>(CLS_REQ)
      : undefined;
    if (!req) return EMPTY;
    // Job runners register a plain object, without Express's helpers.
    const client =
      typeof (req as Partial<Request>).header === 'function'
        ? clientInfoOf(req)
        : null;
    const requestId = req.headers?.[Key.RequestIdTokenHeader];
    return {
      orgId: (req as RequestWithOrg).orgId ?? null,
      userId: req.user?.userId ?? null,
      isAdmin: req.user?.isAdmin === true,
      platformRole: req.user?.platformRole ?? null,
      sessionId: req.user?.sessionId ?? null,
      ip: client?.ip ?? null,
      userAgent: client?.userAgent ?? null,
      requestId: typeof requestId === 'string' ? requestId : null,
    };
  }
}
