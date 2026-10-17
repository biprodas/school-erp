import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

interface PlatformJwtPayload {
  sub: string;
  email: string;
  status?: string;
  isAdmin?: boolean;
  orgId?: string;
}

@Injectable()
export class PlatformJwtStrategy extends PassportStrategy(
  Strategy,
  'platform-jwt',
) {
  constructor(config: ConfigService) {
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

  validate(payload: PlatformJwtPayload) {
    // Tenant tokens share the signing secret and carry their own `isAdmin`
    // (school admin, from the membership). Reject them here so a school admin can't pass
    // PlatformAdminGuard as a platform super-admin.
    if (payload.orgId) {
      throw new UnauthorizedException('Tenant tokens are not valid here');
    }

    return {
      userId: payload.sub,
      email: payload.email,
      status: payload.status,
      isAdmin: payload.isAdmin === true,
    };
  }
}
