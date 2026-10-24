import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessScopeModule } from '~/modules/access-scope/access-scope.module';
import { AuthModule } from '~/modules/auth/auth.module';
import { EnrollmentModule } from '~/modules/enrollments/enrollment.module';
import { FileModule } from '~/modules/files/file.module';
import { GuardianModule } from '~/modules/guardians/guardian.module';
import { JobModule } from '~/modules/jobs/job.module';
import { Organization } from '~/modules/organizations/entities/organization.entity';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { SectionModule } from '~/modules/sections/section.module';
import { SettingsModule } from '~/modules/settings/settings.module';
import { CredentialSlipController } from './credential-slip.controller';
import { CredentialSlipJob } from './credential-slip.job';
import { CredentialSlipService } from './credential-slip.service';

/** Printed sign-in slips for a section's families (PRD 6.3). */
@Module({
  imports: [
    TypeOrmModule.forFeature([Organization]),
    RbacModule,
    AccessScopeModule,
    AuthModule,
    EnrollmentModule,
    GuardianModule,
    SectionModule,
    SettingsModule,
    FileModule,
    JobModule,
  ],
  controllers: [CredentialSlipController],
  providers: [CredentialSlipService, CredentialSlipJob],
})
export class CredentialSlipModule {}
