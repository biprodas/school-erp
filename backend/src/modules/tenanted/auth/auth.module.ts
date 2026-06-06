import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { SignOptions } from 'jsonwebtoken';
import type { StringValue } from 'ms';
import { PassportModule } from '@nestjs/passport';
import { Tenant } from '~/platform/tenants/entities/tenant.entity';
import { TenantUserModule } from '../users/user.module';
import { RbacModule } from '../rbac/rbac.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { ActivationTokenRepository } from './activation-token.repository';

@Module({
  imports: [
    PassportModule,
    // Platform `tenants` table (public schema, default connection) so activation
    // / completion can advance the tenant's onboarding bootstrap status.
    TypeOrmModule.forFeature([Tenant]),
    TenantUserModule,
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
        return {
          secret,
          signOptions,
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, ActivationTokenRepository],
})
export class AuthModule {}
