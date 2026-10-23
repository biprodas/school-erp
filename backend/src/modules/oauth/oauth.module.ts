import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '~/modules/users/entities/user.entity';
import { OAuthState } from '~/modules/auth/entities/oauth-state.entity';
import { AuthModule } from '~/modules/auth/auth.module';
import { OrganizationModule } from '~/modules/organizations/organization.module';
import { SignupModule } from '~/modules/signup/signup.module';
import { GoogleOAuthController } from './controllers/google-oauth.controller';
import {
  GoogleIdentityController,
  PlatformGoogleIdentityController,
} from './controllers/google-identity.controller';
import { GOOGLE_FETCH, GoogleOidcClient } from './google-oidc.client';
import { GoogleAuthService } from './google-auth.service';

/** Google sign-in for both realms (PRD 6.3, doc/domains-and-routing.md 5a). */
@Module({
  imports: [
    TypeOrmModule.forFeature([OAuthState, User]),
    AuthModule,
    OrganizationModule,
    SignupModule,
  ],
  controllers: [
    GoogleOAuthController,
    GoogleIdentityController,
    PlatformGoogleIdentityController,
  ],
  providers: [
    GoogleOidcClient,
    GoogleAuthService,
    {
      provide: GOOGLE_FETCH,
      useValue: (...args: Parameters<typeof fetch>) => fetch(...args),
    },
  ],
})
export class OAuthModule {}
