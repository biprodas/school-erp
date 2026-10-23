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
import { OrgSettingsRepository } from '../repositories/org-settings.repository';
import { deepFreeze, settingsCache } from '../settings.cache';
import {
  DEFAULT_SETTINGS,
  mergeOverrides,
  mergeSettings,
  withDefaults,
} from '../settings.defaults';
import type { OrgSettingsValues, SettingsSection } from '../settings.types';
import { UpdateOrganizationSettingsDto } from '../dto/update-organization-settings.dto';
import { localDate } from '~/shared/dates/local-date';

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
 * school changed with the defaults, memoized for the request and cached in
 * memory per school (`settingsCache`); every write invalidates the cache and
 * is audited with its before and after.
 *
 * Settings sections live in `org_settings` (tenant connection, so an update
 * and its audit row commit together), which stores only the school's
 * overrides. The school's own fields on the platform table `organizations`
 * (name, type, EIIN, directory listing, logo) are written through the root
 * connection, since the app role has no grant on it (see
 * `changeOrganization` for how the change and its audit row are ordered).
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
    const orgId = this.ds.orgId;
    let value = settingsCache.get(orgId);
    if (!value) {
      const generation = settingsCache.generation(orgId);
      const row = await this.settingsRepo.findCurrent();
      value = deepFreeze(withDefaults(row ?? {}));
      settingsCache.set(orgId, value, generation);
    }
    this.memo = value;
    return value;
  }

  async getSection<K extends SettingsSection>(
    section: K,
  ): Promise<OrgSettingsValues[K]> {
    return (await this.get())[section];
  }

  /** Today's date (`YYYY-MM-DD`) in the school's time zone. */
  async today(): Promise<string> {
    return localDate((await this.getSection('locale')).timeZone);
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
   * scalars replace) and returns the section as saved, defaults included.
   * `patch` has been validated by the section's DTO.
   */
  async updateSection<K extends SettingsSection>(
    section: K,
    patch: object,
  ): Promise<OrgSettingsValues[K]> {
    return (await this.writeSection(section, patch)).after;
  }

  /** `PATCH /settings/organization`. */
  async updateOrganization(
    dto: UpdateOrganizationSettingsDto,
  ): Promise<OrganizationSettingsView> {
    const { org } = await this.changeOrganization((org) => {
      if (dto.name !== undefined) org.name = dto.name;
      if (dto.type !== undefined) org.type = dto.type;
      if (dto.eiin !== undefined) org.eiin = dto.eiin;
      if (dto.listedInDirectory !== undefined) {
        org.listedInDirectory = dto.listedInDirectory;
      }
    });
    return orgView(org);
  }

  /** Stores a new logo and points the school at it; the old file goes. */
  async setLogo(file: IncomingFile): Promise<{ fileId: string; url: string }> {
    const stored = await this.files.upload(file, 'org_logo');
    let previous: string | null;
    try {
      ({
        before: { logoFileId: previous },
      } = await this.changeOrganization((org) => {
        org.logoFileId = stored.id;
      }));
    } catch (err) {
      await this.removeQuietly(stored.id);
      throw err;
    }
    if (previous && previous !== stored.id) await this.removeQuietly(previous);
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
    let previous: string | null;
    try {
      ({
        before: { principalSignatureFileId: previous },
      } = await this.writeSection('profile', {
        principalSignatureFileId: stored.id,
      }));
    } catch (err) {
      await this.removeQuietly(stored.id);
      throw err;
    }
    if (previous && previous !== stored.id) await this.removeQuietly(previous);
    return {
      fileId: stored.id,
      url: await this.files.getDownloadUrl(stored.id),
    };
  }

  /**
   * Stores `patch` over the school's overrides for one section, with the
   * row locked so concurrent writes serialize, and audits the effective
   * section before and after. The cache is invalidated after commit.
   */
  private async writeSection<K extends SettingsSection>(
    section: K,
    patch: object,
  ): Promise<{ before: OrgSettingsValues[K]; after: OrgSettingsValues[K] }> {
    const defaults = DEFAULT_SETTINGS[section];
    const result = await this.ds.runInTransaction(async () => {
      const row = await this.settingsRepo.findCurrentForUpdate();
      const stored: unknown = row[section];
      const overrides = mergeOverrides(defaults, stored, patch);
      const before = mergeSettings(defaults, stored ?? undefined);
      const after = mergeSettings(defaults, overrides);
      await this.assertReferences(section, after);

      (row as unknown as Record<SettingsSection, unknown>)[section] = overrides;
      row.updatedBy = this.actorId();
      await this.settingsRepo.save(row);
      await this.audit.record({
        action: AUDIT_ACTIONS.SETTINGS_UPDATED,
        entityType: 'settings',
        entityId: section,
        before: before as unknown as Record<string, unknown>,
        after: after as unknown as Record<string, unknown>,
      });
      return { before, after };
    });
    this.invalidate();
    return result;
  }

  /**
   * Changes the school's row on `organizations` and audits it. The row
   * lives on the root connection and the audit log on the tenant one, so
   * they can't share a transaction. The order makes a failed audit roll the
   * change back: the root transaction locks and updates the row, then the
   * audit row is written and committed on the tenant connection, and only
   * then does the root transaction commit. The remaining window (the root
   * commit failing after the audit committed) leaves an audit row for a
   * change that didn't happen, never an unaudited change.
   *
   * The lock is FOR NO KEY UPDATE, not FOR UPDATE: the audit insert's
   * foreign-key check takes FOR KEY SHARE on the same organization row,
   * which FOR UPDATE would block while this transaction waits for it.
   */
  private changeOrganization(
    apply: (org: Organization) => void,
  ): Promise<{ before: OrganizationSettingsView; org: Organization }> {
    return this.organizations.manager.transaction(async (manager) => {
      const org = await manager.findOne(Organization, {
        where: { id: this.ds.orgId },
        lock: { mode: 'for_no_key_update' },
      });
      if (!org) throw new NotFoundException('Organization not found');
      const before = orgView(org);
      apply(org);
      const saved = await manager.save(org);
      await this.ds.runInTransaction(() =>
        this.recordOrganization(before, orgView(saved)),
      );
      return { before, org: saved };
    });
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
