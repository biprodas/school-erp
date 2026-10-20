import { BadRequestException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { fakeTenantDataSource } from '~/tenancy/tenant-datasource.testing';
import type { RequestContext } from '~/shared/request-context/request-context.service';
import type { AuditService } from '~/modules/audit/services/audit.service';
import type { FileService } from '~/modules/files/file.service';
import type { Organization } from '~/modules/organizations/entities/organization.entity';
import { OrganizationType } from '~/modules/organizations/enums/organization-type.enum';
import type { OrgSettingsRepository } from '../repositories/org-settings.repository';
import { settingsCache } from '../settings.cache';
import { DEFAULT_SETTINGS } from '../settings.defaults';
import { SettingsService } from './settings.service';

const ORG_ID = 'org-test';

describe('SettingsService', () => {
  let service: SettingsService;
  let repo: {
    findCurrent: jest.Mock;
    findCurrentForUpdate: jest.Mock;
    save: jest.Mock;
  };
  let audit: { record: jest.Mock };
  let files: {
    findById: jest.Mock;
    upload: jest.Mock;
    getDownloadUrl: jest.Mock;
    remove: jest.Mock;
  };
  let rootManager: { findOne: jest.Mock; save: jest.Mock };
  let organizations: {
    findOne: jest.Mock;
    manager: { transaction: jest.Mock };
  };
  let org: Partial<Organization>;

  const build = () =>
    new SettingsService(
      repo as unknown as OrgSettingsRepository,
      audit as unknown as AuditService,
      files as unknown as FileService,
      { current: () => ({ userId: 'admin-1' }) } as unknown as RequestContext,
      organizations as unknown as Repository<Organization>,
      fakeTenantDataSource(ORG_ID),
    );

  beforeEach(() => {
    settingsCache.invalidate();
    repo = {
      findCurrent: jest.fn().mockResolvedValue(null),
      // The row exists from the organization's creation, empty.
      findCurrentForUpdate: jest.fn(() => Promise.resolve({ id: 's-1' })),
      save: jest.fn((v: object) => Promise.resolve(v)),
    };
    audit = { record: jest.fn() };
    files = {
      findById: jest.fn(),
      upload: jest.fn().mockResolvedValue({ id: 'file-new' }),
      getDownloadUrl: jest.fn((id: string) =>
        Promise.resolve(`https://s3/${id}`),
      ),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    org = {
      id: ORG_ID,
      name: 'Acme School',
      slug: 'acme',
      type: OrganizationType.SCHOOL,
      eiin: null,
      listedInDirectory: false,
      logoFileId: null,
    };
    rootManager = {
      findOne: jest.fn(() => Promise.resolve({ ...org })),
      save: jest.fn((v: object) => Promise.resolve(v)),
    };
    organizations = {
      findOne: jest.fn(() => Promise.resolve({ ...org })),
      manager: {
        transaction: jest.fn((work: (m: typeof rootManager) => unknown) =>
          work(rootManager),
        ),
      },
    };
    service = build();
  });

  describe('get', () => {
    it('returns the defaults for a school that saved nothing', async () => {
      await expect(service.get()).resolves.toEqual(DEFAULT_SETTINGS);
    });

    it('reads once and shares the result through the cache', async () => {
      repo.findCurrent.mockResolvedValue({ fees: { billingDay: 5 } });

      expect((await service.get()).fees.billingDay).toBe(5);
      await service.get();
      // A new request in the same process hits the in-memory cache.
      expect((await build().get()).fees.billingDay).toBe(5);
      expect(repo.findCurrent).toHaveBeenCalledTimes(1);
    });

    it('hands out frozen values that callers cannot change', async () => {
      const values = await service.get();
      expect(() => {
        values.locale.language = 'bn';
      }).toThrow(TypeError);
    });

    it('does not cache a read overtaken by a write', async () => {
      let finishRead!: (row: object | null) => void;
      repo.findCurrent.mockReturnValueOnce(
        new Promise((resolve) => (finishRead = resolve)),
      );
      const staleRead = build().get();
      await service.updateSection('fees', { billingDay: 5 });
      finishRead(null);
      await staleRead;

      repo.findCurrent.mockResolvedValue({ fees: { billingDay: 5 } });
      expect((await build().get()).fees.billingDay).toBe(5);
    });
  });

  describe('updateSection', () => {
    it('locks the row, stores only the change, audits and returns the section', async () => {
      const saved = await service.updateSection('locale', {
        language: 'bn',
        weekendDays: ['friday', 'saturday'],
      });

      expect(saved).toEqual({
        ...DEFAULT_SETTINGS.locale,
        language: 'bn',
        weekendDays: ['friday', 'saturday'],
      });
      expect(repo.findCurrentForUpdate).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalledWith({
        id: 's-1',
        locale: { language: 'bn', weekendDays: ['friday', 'saturday'] },
        updatedBy: 'admin-1',
      });
      expect(audit.record).toHaveBeenCalledWith({
        action: 'settings.updated',
        entityType: 'settings',
        entityId: 'locale',
        before: DEFAULT_SETTINGS.locale,
        after: saved,
      });
    });

    it('merges into what the school changed before', async () => {
      repo.findCurrentForUpdate.mockResolvedValue({
        id: 's-1',
        profile: { phone: '01712345678', letterhead: { showEiin: false } },
      });

      const saved = await service.updateSection('profile', {
        letterhead: { tagline: 'Knowledge is light' },
      });

      expect(saved.phone).toBe('01712345678');
      expect(saved.letterhead).toMatchObject({
        showEiin: false,
        tagline: 'Knowledge is light',
        showLogo: true,
      });
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          profile: {
            phone: '01712345678',
            letterhead: { showEiin: false, tagline: 'Knowledge is light' },
          },
        }),
      );
    });

    it('invalidates the cache so the next read sees the change', async () => {
      await service.get();
      await service.updateSection('results', { verifyStep: true });
      repo.findCurrent.mockResolvedValue({ results: { verifyStep: true } });

      expect((await service.get()).results.verifyStep).toBe(true);
      expect((await build().get()).results.verifyStep).toBe(true);
    });

    it('refuses a signature id that is not an uploaded signature', async () => {
      files.findById.mockResolvedValue({ id: 'f', purpose: 'student_photo' });

      await expect(
        service.updateSection('profile', {
          principalSignatureFileId: '00000000-0000-4000-8000-000000000001',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });
  });

  describe('organization fields', () => {
    it("updates the school's own fields and audits before and after", async () => {
      const view = await service.updateOrganization({
        eiin: '108224',
        listedInDirectory: true,
      });

      expect(view).toMatchObject({ eiin: '108224', listedInDirectory: true });
      expect(rootManager.findOne).toHaveBeenCalledWith(expect.anything(), {
        where: { id: ORG_ID },
        lock: { mode: 'for_no_key_update' },
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'organization',
          before: expect.objectContaining({ eiin: null }) as unknown,
          after: expect.objectContaining({ eiin: '108224' }) as unknown,
        }),
      );
    });

    it('replaces the logo and removes the old file', async () => {
      org.logoFileId = 'file-old';

      const result = await service.setLogo({
        buffer: Buffer.from(''),
        originalName: 'logo.png',
      });

      expect(files.upload).toHaveBeenCalledWith(expect.anything(), 'org_logo');
      expect(rootManager.save).toHaveBeenCalledWith(
        expect.objectContaining({ logoFileId: 'file-new' }),
      );
      expect(files.remove).toHaveBeenCalledWith('file-old');
      expect(result).toEqual({
        fileId: 'file-new',
        url: 'https://s3/file-new',
      });
    });

    it('keeps the change out when its audit fails, and drops the new logo', async () => {
      org.logoFileId = 'file-old';
      audit.record.mockRejectedValue(new Error('audit down'));

      await expect(
        service.setLogo({ buffer: Buffer.from(''), originalName: 'logo.png' }),
      ).rejects.toThrow('audit down');
      // The failure propagates out of the root transaction, rolling it back.
      expect(files.remove).toHaveBeenCalledWith('file-new');
      expect(files.remove).not.toHaveBeenCalledWith('file-old');
    });
  });

  describe('principal signature', () => {
    beforeEach(() => {
      files.upload.mockResolvedValue({ id: 'sig-new' });
      files.findById.mockResolvedValue({ id: 'sig-new', purpose: 'signature' });
    });

    it('takes the previous file from the locked row and removes it after commit', async () => {
      // A stale cache says "no signature"; the row says otherwise.
      await service.get();
      repo.findCurrentForUpdate.mockResolvedValue({
        id: 's-1',
        profile: { principalSignatureFileId: 'sig-old' },
      });

      const result = await service.setPrincipalSignature({
        buffer: Buffer.from(''),
        originalName: 'sig.png',
      });

      expect(result.fileId).toBe('sig-new');
      expect(files.remove).toHaveBeenCalledWith('sig-old');
      expect(files.remove).not.toHaveBeenCalledWith('sig-new');
    });

    it('removes the new upload when saving fails', async () => {
      repo.save.mockRejectedValue(new Error('db down'));

      await expect(
        service.setPrincipalSignature({
          buffer: Buffer.from(''),
          originalName: 'sig.png',
        }),
      ).rejects.toThrow('db down');
      expect(files.remove).toHaveBeenCalledWith('sig-new');
    });
  });

  it('serves display settings with a signed logo URL', async () => {
    org.logoFileId = 'logo-1';

    await expect(service.getDisplay()).resolves.toEqual({
      name: 'Acme School',
      nameBn: null,
      logoUrl: 'https://s3/logo-1',
      colors: DEFAULT_SETTINGS.profile.colors,
      locale: DEFAULT_SETTINGS.locale,
    });
  });
});
