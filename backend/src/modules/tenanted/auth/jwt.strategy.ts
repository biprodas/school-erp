import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { RequestWithTenant } from '~/tenancy/tenant.middleware';

interface TenantJwtPayload {
  sub: string;
  email: string;
  tenantId?: string;
  schemaName?: string;
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

  validate(req: RequestWithTenant, payload: TenantJwtPayload) {
    // The token must have been issued by the tenant this request resolved to
    // (header/subdomain/domain). Without this, a token from tenant A would be
    // accepted against tenant B's schema, including the isAdmin RBAC bypass.
    if (!payload.tenantId || payload.tenantId !== req.tenantId) {
      throw new UnauthorizedException('Token does not belong to this tenant');
    }

    return {
      userId: payload.sub,
      email: payload.email,
      tenantId: payload.tenantId,
      schemaName: payload.schemaName,
      isAdmin: payload.isAdmin === true,
    };
  }
}
