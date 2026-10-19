import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { FILE_PURPOSES, type UploadPurposeName } from './file-purposes';

/**
 * `@UseInterceptors(FileUpload('student_photo'))` on a feature endpoint:
 * reads one multipart field `file` into memory, capped at the purpose's size
 * so oversized bodies are cut off early. Pass the result to
 * `FileService.upload(...)`, which checks type and size again.
 */
export const FileUpload = (purpose: UploadPurposeName, field = 'file') =>
  FileInterceptor(field, {
    storage: memoryStorage(),
    limits: { fileSize: FILE_PURPOSES[purpose].maxBytes, files: 1 },
  });
