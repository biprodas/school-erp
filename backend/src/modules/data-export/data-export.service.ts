import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import archiver from 'archiver';
import { PassThrough } from 'node:stream';
import type { EntityMetadata } from 'typeorm';
import { AppHosts } from '~/shared/hosts/app-hosts';
import { MailService } from '~/shared/mail/mail.service';
import { QUEUES } from '~/shared/queue';
import { RequestContext } from '~/shared/request-context/request-context.service';
import { orgScopedTables } from '~/tenancy/rls';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';
import { AuditService } from '~/modules/audit/services/audit.service';
import type { Job } from '~/modules/jobs/entities/job.entity';
import { JobService } from '~/modules/jobs/services/job.service';
import { OrgUserService } from '~/modules/users/services/org-user.service';
import { csvRow } from './csv';

export const SCHOOL_EXPORT_JOB = 'school-export';

/** Working tables with nothing for the school to keep. */
const SKIPPED_TABLES = new Set([
  'idempotency_keys',
  'jobs',
  'domain_events',
  'user_sessions',
]);

/** Columns never exported (hashes, tokens, secrets). */
const SECRET_COLUMN = /(hash|token|secret|password)/i;

const BATCH = 2000;

export interface ExportManifest {
  organization: { id: string; slug: string | null; name: string | null };
  exportedAt: string;
  tables: { table: string; file: string; rows: number; columns: string[] }[];
  skippedTables: string[];
  omittedColumns: string[];
}

/**
 * The school's full data export (PRD 6.24): one CSV per school table read
 * through the tenant connection (RLS applies, encrypted fields come out
 * decrypted), the members with their roles, and a manifest, zipped into
 * storage. The requester gets an email with a link to the download.
 */
@Injectable()
export class DataExportService {
  constructor(
    private readonly jobs: JobService,
    private readonly members: OrgUserService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly hosts: AppHosts,
    private readonly context: RequestContext,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  /** Owner and school admins only; audited as `data.exported`. */
  async start(isAdmin: boolean): Promise<Job> {
    if (!isAdmin) {
      throw new ForbiddenException({
        message: 'Only the owner or a school admin can export all data',
        code: 'SCHOOL_ADMIN_ONLY',
      });
    }
    await this.audit.record({
      action: AUDIT_ACTIONS.DATA_EXPORTED,
      entityType: 'school',
      entityId: this.ds.orgId,
      after: { format: 'csv-zip' },
    });
    return this.jobs.start<Record<string, never>>({
      type: 'settings.export',
      queue: QUEUES.exports,
      name: SCHOOL_EXPORT_JOB,
      data: {},
      options: { attempts: 1 },
    });
  }

  /** The job's work: the zip's bytes and its manifest. */
  async build(): Promise<{ buffer: Buffer; manifest: ExportManifest }> {
    const zip = archiver('zip', { zlib: { level: 6 } });
    const sink = new PassThrough();
    const chunks: Buffer[] = [];
    sink.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<void>((resolve, reject) => {
      sink.on('end', resolve);
      zip.on('error', reject);
    });
    zip.pipe(sink);

    const manager = this.ds.getManager();
    // The school's tables are exactly those under row-level security.
    const scoped = new Set(orgScopedTables(manager.connection));
    const tables = manager.connection.entityMetadatas
      .filter((m) => scoped.has(m.tableName))
      .sort((a, b) => a.tableName.localeCompare(b.tableName));
    const manifest: ExportManifest = {
      organization: { id: this.ds.orgId, slug: null, name: null },
      exportedAt: new Date().toISOString(),
      tables: [],
      skippedTables: [],
      omittedColumns: [],
    };
    for (const meta of tables) {
      if (SKIPPED_TABLES.has(meta.tableName)) {
        manifest.skippedTables.push(meta.tableName);
        continue;
      }
      const { csv, rows, columns, omitted } = await this.tableCsv(meta);
      zip.append(csv, { name: `${meta.tableName}.csv` });
      manifest.tables.push({
        table: meta.tableName,
        file: `${meta.tableName}.csv`,
        rows,
        columns,
      });
      manifest.omittedColumns.push(
        ...omitted.map((c) => `${meta.tableName}.${c}`),
      );
    }

    const members = await this.members.findFiltered({});
    const memberColumns = [
      'user_id',
      'name',
      'email',
      'phone',
      'status',
      'is_admin',
      'roles',
      'joined_at',
    ];
    zip.append(
      csvRow(memberColumns) +
        members
          .map((m) =>
            csvRow([
              m.id,
              m.name,
              m.email,
              m.phone,
              m.status,
              m.isAdmin,
              m.roles.map((r) => r.name).join('; '),
              m.createdAt,
            ]),
          )
          .join(''),
      { name: 'members.csv' },
    );
    manifest.tables.push({
      table: 'members',
      file: 'members.csv',
      rows: members.length,
      columns: memberColumns,
    });
    zip.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
    await zip.finalize();
    await done;
    return { buffer: Buffer.concat(chunks), manifest };
  }

  /** Emails the requester where to download it (the job's page). */
  async notifyRequester(jobId: string, orgSlug: string): Promise<void> {
    const userId = this.context.current().userId;
    if (!userId) return;
    const [me] = await this.members.activeContacts([userId]);
    if (!me?.email) return;
    const link = this.hosts.url(
      this.hosts.schoolHost(orgSlug),
      `/settings/data-export?job=${jobId}`,
    );
    await this.mail.sendDataExportReady(me.email, me.name, link);
  }

  private async tableCsv(meta: EntityMetadata) {
    const manager = this.ds.getManager();
    const columns = meta.columns.filter(
      (c) => !SECRET_COLUMN.test(c.databaseName),
    );
    const omitted = meta.columns
      .filter((c) => SECRET_COLUMN.test(c.databaseName))
      .map((c) => c.databaseName);
    const order = Object.fromEntries(
      meta.primaryColumns.map((c) => [c.propertyName, 'ASC']),
    );
    let csv = csvRow(columns.map((c) => c.databaseName));
    let rows = 0;
    for (let skip = 0; ; skip += BATCH) {
      const batch = await manager.find(meta.target, {
        where: { orgId: this.ds.orgId },
        order,
        skip,
        take: BATCH,
        withDeleted: true,
      });
      for (const entity of batch as Record<string, unknown>[]) {
        csv += csvRow(columns.map((c) => c.getEntityValue(entity) as unknown));
      }
      rows += batch.length;
      if (batch.length < BATCH) break;
    }
    return { csv, rows, columns: columns.map((c) => c.databaseName), omitted };
  }
}
