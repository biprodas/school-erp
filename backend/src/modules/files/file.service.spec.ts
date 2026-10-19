import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { StorageService } from '~/shared/storage/storage.service';
import type { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import type { FileRepository } from './file.repository';
import { FileService } from './file.service';
import { MIME } from './file-type';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);
const PDF = Buffer.from('%PDF-1.7 body');

describe('FileService', () => {
  let storage: { put: jest.Mock; delete: jest.Mock; getSignedUrl: jest.Mock };
  let repo: {
    saveNew: jest.Mock;
    findByIdOrFail: jest.Mock;
    remove: jest.Mock;
  };
  let service: FileService;

  beforeEach(() => {
    storage = {
      put: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      getSignedUrl: jest.fn().mockResolvedValue('https://signed'),
    };
    repo = {
      saveNew: jest.fn((data: unknown) => Promise.resolve(data)),
      findByIdOrFail: jest.fn(),
      remove: jest.fn(),
    };
    const config = {
      get: () => ({ uploadMaxBytes: 5 * 1024 * 1024 }),
    } as unknown as ConfigService;
    service = new FileService(
      repo as unknown as FileRepository,
      storage as unknown as StorageService,
      { orgId: 'org-a' } as TenantDataSourceProxy,
      { user: { userId: 'user-1' } } as never,
      config,
    );
  });

  it('stores an allowed file under the org prefix with sniffed metadata', async () => {
    const file = await service.upload(
      { buffer: PNG, originalName: 'photo.png' },
      'student_photo',
    );

    expect(file.key).toMatch(/^orgs\/org-a\/photos\/[0-9a-f-]{36}$/);
    expect(file).toMatchObject({
      mime: MIME.png,
      size: PNG.length,
      purpose: 'student_photo',
      uploadedBy: 'user-1',
      originalName: 'photo.png',
    });
    expect(file.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(storage.put).toHaveBeenCalledWith(
      file.key,
      PNG,
      MIME.png,
      'photo.png',
    );
  });

  it('rejects a type the purpose does not allow, whatever the file name says', async () => {
    await expect(
      service.upload(
        { buffer: PDF, originalName: 'photo.png' },
        'student_photo',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('rejects files over the purpose limit', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]);
    await expect(
      service.upload({ buffer: big, originalName: 'big.png' }, 'student_photo'),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
  });

  it('rejects empty files', async () => {
    await expect(
      service.upload(
        { buffer: Buffer.alloc(0), originalName: 'x.pdf' },
        'attachment',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('removes the object again when the metadata row cannot be saved', async () => {
    repo.saveNew.mockRejectedValueOnce(new Error('db down'));
    await expect(
      service.upload(
        { buffer: PDF, originalName: 'tc.pdf' },
        'student_document',
      ),
    ).rejects.toThrow('db down');
    const [[storedKey]] = storage.put.mock.calls as [[string]];
    expect(storage.delete).toHaveBeenCalledWith(storedKey);
  });

  it('signs a download URL for a file of this org', async () => {
    repo.findByIdOrFail.mockResolvedValue({ key: 'orgs/org-a/documents/1' });
    await expect(service.getDownloadUrl('1')).resolves.toBe('https://signed');
    expect(storage.getSignedUrl).toHaveBeenCalledWith('orgs/org-a/documents/1');
  });
});
