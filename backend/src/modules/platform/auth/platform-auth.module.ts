import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import type { SignOptions } from 'jsonwebtoken';
import type { StringValue } from 'ms';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/modules/platform/users/entities/user.entity';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformAuthController } from './platform-auth.controller';
import { PlatformJwtStrategy } from './platform-jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule,
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
  controllers: [PlatformAuthController],
  providers: [PlatformAuthService, PlatformJwtStrategy],
  exports: [PlatformAuthService],
})
export class PlatformAuthModule {}
