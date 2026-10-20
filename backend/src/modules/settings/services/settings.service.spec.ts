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
  let repo: { findCurrent: jest.Mock; saveNew: jest.Mock; save: jest.Mock };
  let audit: { record: jest.Mock };
  let files: {
    findById: jest.Mock;
    upload: jest.Mock;
    getDownloadUrl: jest.Mock;
    remove: jest.Mock;
  };
  let organizations: { findOne: jest.Mock; save: jest.Mock };
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
      saveNew: jest.fn((v: object) => Promise.resolve({ id: 's-1', ...v })),
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
    organizations = {
      findOne: jest.fn(() => Promise.resolve({ ...org })),
      save: jest.fn((v: object) => Promise.resolve(v)),
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
  });

  describe('updateSection', () => {
    it('creates the row on first save, merges, audits and returns the section', async () => {
      const saved = await service.updateSection('locale', {
        language: 'bn',
        weekendDays: ['friday', 'saturday'],
      });

      expect(saved).toEqual({
        ...DEFAULT_SETTINGS.locale,
        language: 'bn',
        weekendDays: ['friday', 'saturday'],
      });
      expect(repo.saveNew).toHaveBeenCalledWith({ updatedBy: 'admin-1' });
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ locale: saved, updatedBy: 'admin-1' }),
      );
      expect(audit.record).toHaveBeenCalledWith({
        action: 'settings.updated',
        entityType: 'settings',
        entityId: 'locale',
        before: DEFAULT_SETTINGS.locale,
        after: saved,
      });
    });

    it('merges into what the school saved before', async () => {
      repo.findCurrent.mockResolvedValue({
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
      expect(repo.saveNew).not.toHaveBeenCalled();
    });

    it('invalidates the cache so the next read sees the change', async () => {
      await service.get();
      repo.findCurrent.mockResolvedValue({ id: 's-1' });
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
      expect(organizations.save).toHaveBeenCalledWith(
        expect.objectContaining({ logoFileId: 'file-new' }),
      );
      expect(files.remove).toHaveBeenCalledWith('file-old');
      expect(result).toEqual({
        fileId: 'file-new',
        url: 'https://s3/file-new',
      });
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
