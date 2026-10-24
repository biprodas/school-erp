import { NotFoundException } from '@nestjs/common';
import type { TestingModuleBuilder } from '@nestjs/testing';
import { StorageService } from '~/shared/storage/storage.service';

/**
 * `StorageService` in memory, for specs that upload or generate files
 * without an S3 endpoint (CI has none). Signed URLs are fake but stable.
 */
export class MemoryStorage {
  readonly objects = new Map<string, { body: Buffer; contentType: string }>();

  put(key: string, body: Buffer, contentType: string): Promise<void> {
    this.objects.set(key, { body, contentType });
    return Promise.resolve();
  }

  getSignedUrl(key: string): Promise<string> {
    return Promise.resolve(`https://storage.test/${key}?signed=1`);
  }

  getBuffer(key: string): Promise<Buffer> {
    const object = this.objects.get(key);
    if (!object) throw new NotFoundException(`No object ${key}`);
    return Promise.resolve(object.body);
  }

  ping(): Promise<void> {
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.objects.delete(key);
    return Promise.resolve();
  }

  onApplicationShutdown(): void {}
}

/** `bootApp(withMemoryStorage(storage))`. */
export const withMemoryStorage =
  (storage: MemoryStorage) => (builder: TestingModuleBuilder) =>
    builder.overrideProvider(StorageService).useValue(storage);
