import { Module } from '@nestjs/common';
import { FileRepository } from './file.repository';
import { FileService } from './file.service';
import { PlanModule } from '~/modules/plans/plan.module';

/** Stored-file metadata and uploads; the bytes go through StorageService. */
@Module({
  imports: [PlanModule],
  providers: [FileRepository, FileService],
  exports: [FileService],
})
export class FileModule {}
