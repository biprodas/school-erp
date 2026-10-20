import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileModule } from '~/modules/files/file.module';
import { Organization } from '~/modules/organizations/entities/organization.entity';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { SettingsController } from './controllers/settings.controller';
import { OrgSettingsRepository } from './repositories/org-settings.repository';
import { OrgSettingsReader } from './services/org-settings.reader';
import { SettingsService } from './services/settings.service';

/**
 * School settings (PRD 6.24): `SettingsService` inside requests,
 * `OrgSettingsReader` for singletons (e.g. the session idle timeout in
 * AuthModule). Uses the `Organization` entity directly for the school's own
 * fields on that platform table rather than OrganizationModule, which
 * depends on AuthModule.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Organization]), RbacModule, FileModule],
  controllers: [SettingsController],
  providers: [OrgSettingsRepository, SettingsService, OrgSettingsReader],
  exports: [SettingsService, OrgSettingsReader],
})
export class SettingsModule {}
