import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import type { SignOptions } from 'jsonwebtoken';
import type { StringValue } from 'ms';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '~/modules/users/entities/user.entity';
import { Membership } from '~/modules/memberships/entities/membership.entity';
import { Organization } from '~/modules/organizations/entities/organization.entity';
import { UserModule } from '~/modules/users/user.module';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { AuthToken } from './entities/auth-token.entity';
import { AuthController } from './controllers/auth.controller';
import { PlatformAuthController } from './controllers/platform-auth.controller';
import { AuthService } from './services/auth.service';
import { PlatformAuthService } from './services/platform-auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PlatformJwtStrategy } from './strategies/platform-jwt.strategy';
import { AuthTokenRepository } from './repositories/auth-token.repository';
import { OwnerProvisioningService } from './services/owner-provisioning.service';

/**
 * Both auth realms, sharing one JWT signing config:
 * - Platform (`/platform/auth`, `'platform-jwt'` strategy): super-admin and
 *   organization management. Tokens never carry `orgId`.
 * - Tenant (`/auth`, `'jwt'` strategy / `JwtAuthGuard`): sign-in inside one
 *   organization. Tokens carry `orgId` and are only valid for that org.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([User, AuthToken, Membership, Organization]),
    PassportModule,
    UserModule,
    RbacModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => {
        const secret = config.get<string>('jwt.secret');
        const expiresIn = config.get<string>('jwt.expiresIn');
        if (!secret) {
          throw new Error('jwt.secret is not configured');
        }
        const signOptions: SignOptions = {
          expiresIn: (expiresIn ?? '24h') as StringValue,
        };
        return { secret, signOptions };
      },
    }),
  ],
  controllers: [PlatformAuthController, AuthController],
  providers: [
    PlatformAuthService,
    PlatformJwtStrategy,
    AuthService,
    JwtStrategy,
    AuthTokenRepository,
    OwnerProvisioningService,
  ],
  exports: [PlatformAuthService, OwnerProvisioningService],
})
export class AuthModule {}
