import { Module } from '@nestjs/common';
import { FileRepository } from './file.repository';
import { FileService } from './file.service';

/** Stored-file metadata and uploads; the bytes go through StorageService. */
@Module({
  providers: [FileRepository, FileService],
  exports: [FileService],
})
export class FileModule {}
