import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { RequestWithOrg } from '~/tenancy/tenant.middleware';
import type { AuthUser } from '~/common/auth/auth-user';

export interface TenantJwtPayload {
  sub: string;
  email: string;
  orgId?: string;
  /** School admin flag from the user's membership in `orgId`. */
  isAdmin?: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
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

  validate(req: RequestWithOrg, payload: TenantJwtPayload): AuthUser {
    // The token must have been issued by the organization this request
    // resolved to (header/subdomain/domain). Without this, a token from org A
    // would be accepted against org B, including the isAdmin RBAC bypass.
    if (!payload.orgId || payload.orgId !== req.orgId) {
      throw new UnauthorizedException(
        'Token does not belong to this organization',
      );
    }

    return {
      userId: payload.sub,
      email: payload.email,
      orgId: payload.orgId,
      isAdmin: payload.isAdmin === true,
    };
  }
}
