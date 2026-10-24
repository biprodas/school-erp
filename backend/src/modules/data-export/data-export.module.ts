import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileModule } from '~/modules/files/file.module';
import { JobModule } from '~/modules/jobs/job.module';
import { Organization } from '~/modules/organizations/entities/organization.entity';
import { UserModule } from '~/modules/users/user.module';
import { DataExportController } from './data-export.controller';
import { DataExportJob } from './data-export.job';
import { DataExportService } from './data-export.service';

/** The full school data export (`POST /settings/export`). */
@Module({
  imports: [
    TypeOrmModule.forFeature([Organization]),
    UserModule,
    FileModule,
    JobModule,
  ],
  controllers: [DataExportController],
  providers: [DataExportService, DataExportJob],
})
export class DataExportModule {}
