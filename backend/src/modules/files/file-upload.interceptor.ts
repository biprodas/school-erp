import { BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { FILE_PURPOSES, type UploadPurposeName } from './file-purposes';
import type { IncomingFile } from './file.service';

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

/** Swagger body for a single multipart `file`. */
export const UPLOAD_BODY = {
  schema: {
    type: 'object',
    properties: { file: { type: 'string', format: 'binary' } },
    required: ['file'],
  },
};

/** The upload as an `IncomingFile`; 400 unless the multipart field `file` was sent. */
export function requireFile(
  file: Express.Multer.File | undefined,
): IncomingFile {
  if (!file) {
    throw new BadRequestException({
      message: 'Attach the file as the multipart field "file"',
      code: 'FILE_REQUIRED',
    });
  }
  return { buffer: file.buffer, originalName: file.originalname };
}
