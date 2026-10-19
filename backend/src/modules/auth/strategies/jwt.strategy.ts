import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { RequestWithOrg } from '~/tenancy/tenant.middleware';
import type { AuthUser } from '~/common/auth/auth-user';
import { SessionService } from '../services/session.service';

export interface TenantJwtPayload {
  sub: string;
  orgId: string;
  /** School admin flag from the user's membership in `orgId`. */
  isAdmin: boolean;
  /** Session (refresh-token family); revoked sessions are refused. */
  sid: string;
  /** Present (true) while the user must change a temporary password. */
  mcp?: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly sessions: SessionService,
  ) {
    const secret = config.get<string>('jwt.secret');
    if (!secret) {
      throw new Error('jwt.secret is not configured');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
    });
  }

  async validate(
    req: RequestWithOrg,
    payload: Partial<TenantJwtPayload>,
  ): Promise<AuthUser> {
    // The token must have been issued by the organization this request
    // resolved to (header/subdomain/domain). Without this, a token from org A
    // would be accepted against org B, including the isAdmin RBAC bypass.
    if (!payload.orgId || payload.orgId !== req.orgId) {
      throw new UnauthorizedException(
        'Token does not belong to this organization',
      );
    }
    if (!payload.sub || !payload.sid) {
      throw new UnauthorizedException('Invalid token');
    }
    if (!(await this.sessions.isActive(payload.sid))) {
      throw new UnauthorizedException({
        message: 'Your session has ended. Please sign in again.',
        code: 'SESSION_REVOKED',
      });
    }

    return {
      userId: payload.sub,
      orgId: payload.orgId,
      isAdmin: payload.isAdmin === true,
      sessionId: payload.sid,
      mustChangePassword: payload.mcp === true,
    };
  }
}
