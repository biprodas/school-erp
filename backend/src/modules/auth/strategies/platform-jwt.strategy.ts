import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthUser } from '~/common/auth/auth-user';
import {
  PlatformRole,
  isPlatformRole,
} from '~/modules/users/enums/platform-role.enum';
import { UserStatus } from '~/modules/users/enums/user-status.enum';
import { SessionService } from '../services/session.service';

export interface PlatformJwtPayload {
  sub: string;
  status: UserStatus;
  /** The user's platform role when the token was issued. */
  role: PlatformRole;
  /** Session (refresh-token family); revoked sessions are refused. */
  sid: string;
  /** Present (true) while the user must change a temporary password. */
  mcp?: boolean;
  /** Never set on platform tokens; tenant tokens carry it and are refused. */
  orgId?: string;
}

@Injectable()
export class PlatformJwtStrategy extends PassportStrategy(
  Strategy,
  'platform-jwt',
) {
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
    });
  }

  async validate(payload: Partial<PlatformJwtPayload>): Promise<AuthUser> {
    // Tenant tokens share the signing secret; reject them so a school
    // session never acts on platform routes.
    if (payload.orgId) {
      throw new UnauthorizedException('Tenant tokens are not valid here');
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
      status: payload.status,
      isAdmin: false,
      // A token from before roles were in it reads as no role until its
      // refresh, which issues one with the role.
      platformRole: isPlatformRole(payload.role)
        ? payload.role
        : PlatformRole.USER,
      sessionId: payload.sid,
      mustChangePassword: payload.mcp === true,
    };
  }
}
