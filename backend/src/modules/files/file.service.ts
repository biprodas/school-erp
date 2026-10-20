import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { REQUEST } from '@nestjs/core';
import type { Request } from 'express';
import { createHash, randomUUID } from 'node:crypto';
import type { StorageConfig } from '~/config';
import { StorageService } from '~/shared/storage/storage.service';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { StoredFile } from './entities/stored-file.entity';
import { FileRepository } from './file.repository';
import {
  FILE_PURPOSES,
  type FilePurposeName,
  type UploadPurposeName,
} from './file-purposes';
import { detectMime } from './file-type';

export interface IncomingFile {
  buffer: Buffer;
  originalName: string;
}

/**
 * Stores files for the current school. Feature modules call it behind their
 * own permission checks (e.g. `POST /students/:id/photo` needs
 * `students:update`) and hand out `getDownloadUrl` only after checking that
 * the caller may see the owning record.
 */
@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);
  private readonly maxBytes: number;

  constructor(
    private readonly fileRepo: FileRepository,
    private readonly storage: StorageService,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
    @Inject(REQUEST) private readonly req: Request,
    config: ConfigService,
  ) {
    this.maxBytes = config.get<StorageConfig>('storage')!.uploadMaxBytes;
  }

  /** Validates a client upload against its purpose, then stores it. */
  upload(file: IncomingFile, purpose: UploadPurposeName): Promise<StoredFile> {
    return this.store(file, purpose);
  }

  /** Stores a server-generated file (export, PDF bundle). */
  storeGenerated(file: IncomingFile): Promise<StoredFile> {
    return this.store(file, 'generated');
  }

  /** A stored file of this school; 404 if there is none. */
  findById(id: string): Promise<StoredFile> {
    return this.fileRepo.findByIdOrFail(id);
  }

  async getDownloadUrl(id: string): Promise<string> {
    const file = await this.fileRepo.findByIdOrFail(id);
    return this.storage.getSignedUrl(file.key);
  }

  async remove(id: string): Promise<void> {
    const file = await this.fileRepo.findByIdOrFail(id);
    await this.fileRepo.remove(file);
    await this.storage
      .delete(file.key)
      .catch((err: Error) =>
        this.logger.warn(`Orphaned object ${file.key}: ${err.message}`),
      );
  }

  private async store(
    file: IncomingFile,
    purposeName: FilePurposeName,
  ): Promise<StoredFile> {
    const purpose = FILE_PURPOSES[purposeName];
    const limit = Math.min(purpose.maxBytes, this.maxBytes);
    if (file.buffer.length === 0) {
      throw new BadRequestException({
        message: 'The file is empty',
        code: 'FILE_EMPTY',
      });
    }
    if (file.buffer.length > limit) {
      throw new PayloadTooLargeException({
        message: `The file is larger than ${Math.floor(limit / 1024)} KB`,
        code: 'FILE_TOO_LARGE',
      });
    }
    const mime = detectMime(file.buffer);
    if (!mime || !(purpose.mimes as readonly string[]).includes(mime)) {
      throw new BadRequestException({
        message: 'This file type is not allowed here',
        code: 'FILE_TYPE_NOT_ALLOWED',
      });
    }
    // TODO(M1): check the plan's storage quota (EntitlementService).

    const id = randomUUID();
    const key = StorageService.orgKey(this.ds.orgId, purpose.folder, id);
    const originalName = file.originalName.slice(0, 255) || 'file';
    await this.storage.put(key, file.buffer, mime, originalName);
    try {
      return await this.fileRepo.saveNew({
        id,
        key,
        originalName,
        mime,
        size: file.buffer.length,
        sha256: createHash('sha256').update(file.buffer).digest('hex'),
        purpose: purposeName,
        uploadedBy: this.req.user?.userId ?? null,
      });
    } catch (err) {
      await this.storage.delete(key).catch(() => undefined);
      throw err;
    }
  }
}
