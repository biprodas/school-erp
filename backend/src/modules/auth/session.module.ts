import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsModule } from '~/modules/settings/settings.module';
import { UserSession } from './entities/user-session.entity';
import { SessionService } from './services/session.service';

/**
 * Sign-in sessions on their own, so modules that `AuthModule` depends on
 * (`UserModule`, `MembershipModule`) can end a user's sessions when their
 * access changes, without an import cycle.
 */
@Module({
  imports: [TypeOrmModule.forFeature([UserSession]), SettingsModule],
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionModule {}
