import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { RequestContext } from '~/shared/request-context/request-context.service';
import { AuditService } from '~/modules/audit/services/audit.service';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';
import { FileService, IncomingFile } from '~/modules/files/file.service';
import { Organization } from '~/modules/organizations/entities/organization.entity';
import { OrgSettings } from '../entities/org-settings.entity';
import { OrgSettingsRepository } from '../repositories/org-settings.repository';
import { settingsCache } from '../settings.cache';
import { mergeSettings, withDefaults } from '../settings.defaults';
import type { OrgSettingsValues, SettingsSection } from '../settings.types';
import { UpdateOrganizationSettingsDto } from '../dto/update-organization-settings.dto';

/** The school's own fields on `organizations`, as settings show them. */
export interface OrganizationSettingsView {
  id: string;
  name: string;
  slug: string;
  type: Organization['type'];
  status: Organization['status'];
  eiin: string | null;
  listedInDirectory: boolean;
  logoFileId: string | null;
  trialEndsAt: Date | null;
  onboardingCompletedAt: Date | null;
}

export interface SettingsView extends OrgSettingsValues {
  organization: OrganizationSettingsView;
  /** Signed, short-lived download URLs of the branding files. */
  files: { logoUrl: string | null; principalSignatureUrl: string | null };
}

/** What every signed-in member may read: enough to brand and format pages. */
export interface DisplaySettings {
  name: string;
  nameBn: string | null;
  logoUrl: string | null;
  colors: OrgSettingsValues['profile']['colors'];
  locale: OrgSettingsValues['locale'];
}

const orgView = (org: Organization): OrganizationSettingsView => ({
  id: org.id,
  name: org.name,
  slug: org.slug,
  type: org.type,
  status: org.status,
  eiin: org.eiin,
  listedInDirectory: org.listedInDirectory,
  logoFileId: org.logoFileId,
  trialEndsAt: org.trialEndsAt,
  onboardingCompletedAt: org.onboardingCompletedAt,
});

/**
 * The current school's settings (PRD 6.24). `get()` completes what the
 * school saved with the defaults, memoized for the request and cached in
 * memory per school (`settingsCache`); every write invalidates the cache and
 * is audited with its before and after.
 *
 * Settings sections live in `org_settings` (tenant connection, so an update
 * and its audit row commit together). The school's own fields on the
 * platform table `organizations` (name, type, EIIN, directory listing, logo)
 * are written through the root connection, since the app role has no grant
 * on it; their audit row follows the change.
 */
@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private memo?: OrgSettingsValues;

  constructor(
    private readonly settingsRepo: OrgSettingsRepository,
    private readonly audit: AuditService,
    private readonly files: FileService,
    private readonly context: RequestContext,
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  /** Every section, with defaults for anything not saved. */
  async get(): Promise<OrgSettingsValues> {
    if (this.memo) return this.memo;
    let value = settingsCache.get(this.ds.orgId);
    if (!value) {
      value = withDefaults((await this.settingsRepo.findCurrent()) ?? {});
      settingsCache.set(this.ds.orgId, value);
    }
    this.memo = value;
    return value;
  }

  async getSection<K extends SettingsSection>(
    section: K,
  ): Promise<OrgSettingsValues[K]> {
    return (await this.get())[section];
  }

  /** `GET /settings`: the sections plus the organization fields and files. */
  async getAll(): Promise<SettingsView> {
    const [values, org] = [await this.get(), await this.findOrganization()];
    return {
      organization: orgView(org),
      ...values,
      files: {
        logoUrl: await this.downloadUrl(org.logoFileId),
        principalSignatureUrl: await this.downloadUrl(
          values.profile.principalSignatureFileId,
        ),
      },
    };
  }

  async getDisplay(): Promise<DisplaySettings> {
    const [values, org] = [await this.get(), await this.findOrganization()];
    return {
      name: org.name,
      nameBn: values.profile.nameBn,
      logoUrl: await this.downloadUrl(org.logoFileId),
      colors: values.profile.colors,
      locale: values.locale,
    };
  }

  /**
   * Merges `patch` into one section (nested objects merge, arrays and
   * scalars replace) and returns the section as saved. `patch` has been
   * validated by the section's DTO.
   */
  async updateSection<K extends SettingsSection>(
    section: K,
    patch: object,
  ): Promise<OrgSettingsValues[K]> {
    const saved = await this.ds.runInTransaction(async () => {
      const row = await this.findOrCreateRow();
      const before = withDefaults(row)[section];
      const after = mergeSettings(before, patch);
      await this.assertReferences(section, after);

      (row as unknown as Record<SettingsSection, unknown>)[section] = after;
      row.updatedBy = this.actorId();
      await this.settingsRepo.save(row);
      await this.audit.record({
        action: AUDIT_ACTIONS.SETTINGS_UPDATED,
        entityType: 'settings',
        entityId: section,
        before: before as unknown as Record<string, unknown>,
        after: after as unknown as Record<string, unknown>,
      });
      return after;
    });
    this.invalidate();
    return saved;
  }

  /** `PATCH /settings/organization`. */
  async updateOrganization(
    dto: UpdateOrganizationSettingsDto,
  ): Promise<OrganizationSettingsView> {
    const org = await this.findOrganization();
    const before = orgView(org);
    if (dto.name !== undefined) org.name = dto.name;
    if (dto.type !== undefined) org.type = dto.type;
    if (dto.eiin !== undefined) org.eiin = dto.eiin;
    if (dto.listedInDirectory !== undefined) {
      org.listedInDirectory = dto.listedInDirectory;
    }
    const saved = await this.organizations.save(org);
    await this.recordOrganization(before, orgView(saved));
    return orgView(saved);
  }

  /** Stores a new logo and points the school at it; the old file goes. */
  async setLogo(file: IncomingFile): Promise<{ fileId: string; url: string }> {
    const stored = await this.files.upload(file, 'org_logo');
    const org = await this.findOrganization();
    const before = orgView(org);
    const previous = org.logoFileId;
    org.logoFileId = stored.id;
    await this.organizations.save(org);
    await this.recordOrganization(before, orgView(org));
    if (previous) await this.removeQuietly(previous);
    return {
      fileId: stored.id,
      url: await this.files.getDownloadUrl(stored.id),
    };
  }

  /** Stores the principal's signature (used on report cards, certificates). */
  async setPrincipalSignature(
    file: IncomingFile,
  ): Promise<{ fileId: string; url: string }> {
    const stored = await this.files.upload(file, 'signature');
    const previous = (await this.get()).profile.principalSignatureFileId;
    await this.updateSection('profile', {
      principalSignatureFileId: stored.id,
    });
    if (previous) await this.removeQuietly(previous);
    return {
      fileId: stored.id,
      url: await this.files.getDownloadUrl(stored.id),
    };
  }

  private async findOrCreateRow(): Promise<OrgSettings> {
    return (
      (await this.settingsRepo.findCurrent()) ??
      // A concurrent first save loses on `uq_org_settings_org` (409).
      (await this.settingsRepo.saveNew({ updatedBy: this.actorId() }))
    );
  }

  /** Ids inside a section must point at this school's own records. */
  private async assertReferences(
    section: SettingsSection,
    value: unknown,
  ): Promise<void> {
    if (section !== 'profile') return;
    const fileId = (value as OrgSettingsValues['profile'])
      .principalSignatureFileId;
    if (!fileId) return;
    const file = await this.files.findById(fileId).catch(() => null);
    if (file?.purpose !== 'signature') {
      throw new BadRequestException({
        message: 'principalSignatureFileId must be an uploaded signature',
        code: 'INVALID_SIGNATURE_FILE',
      });
    }
  }

  private recordOrganization(
    before: OrganizationSettingsView,
    after: OrganizationSettingsView,
  ): Promise<void> {
    return this.audit.record({
      action: AUDIT_ACTIONS.SETTINGS_UPDATED,
      entityType: 'settings',
      entityId: 'organization',
      before: { ...before },
      after: { ...after },
    });
  }

  private async findOrganization(): Promise<Organization> {
    const org = await this.organizations.findOne({
      where: { id: this.ds.orgId },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  private async downloadUrl(fileId: string | null): Promise<string | null> {
    if (!fileId) return null;
    try {
      return await this.files.getDownloadUrl(fileId);
    } catch {
      // A removed file shouldn't break the settings page.
      return null;
    }
  }

  private async removeQuietly(fileId: string): Promise<void> {
    await this.files
      .remove(fileId)
      .catch((err: Error) =>
        this.logger.warn(`Could not remove file ${fileId}: ${err.message}`),
      );
  }

  private actorId(): string | null {
    return this.context.current().userId;
  }

  private invalidate(): void {
    this.memo = undefined;
    settingsCache.invalidate(this.ds.orgId);
  }
}
