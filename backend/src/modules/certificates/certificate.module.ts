import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { AccessScopeModule } from '~/modules/access-scope/access-scope.module';
import { EnrollmentModule } from '~/modules/enrollments/enrollment.module';
import { FileModule } from '~/modules/files/file.module';
import { GuardianModule } from '~/modules/guardians/guardian.module';
import { JobModule } from '~/modules/jobs/job.module';
import { NumberingModule } from '~/modules/numbering/numbering.module';
import { SectionModule } from '~/modules/sections/section.module';
import { SettingsModule } from '~/modules/settings/settings.module';
import { StudentModule } from '~/modules/students/student.module';
import { CertificatePdfJob } from './certificate-pdf.job';
import { CertificateRepository } from './certificate.repository';
import { CertificateController } from './controllers/certificate.controller';
import { PublicCertificateController } from './controllers/public-certificate.controller';
import { Certificate } from './entities/certificate.entity';
import { CertificateService } from './services/certificate.service';
import { IdCardService } from './services/id-card.service';
import { PublicCertificateService } from './services/public-certificate.service';

/** Certificates with QR verification and ID cards (PRD 6.6). */
@Module({
  imports: [
    TypeOrmModule.forFeature([Certificate]),
    RbacModule,
    AccessScopeModule,
    StudentModule,
    EnrollmentModule,
    GuardianModule,
    SectionModule,
    SettingsModule,
    NumberingModule,
    FileModule,
    JobModule,
  ],
  controllers: [CertificateController, PublicCertificateController],
  providers: [
    CertificateRepository,
    CertificateService,
    IdCardService,
    PublicCertificateService,
    CertificatePdfJob,
  ],
})
export class CertificateModule {}
