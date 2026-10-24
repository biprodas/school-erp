import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { Paginated } from '~/common/dto/paginated.dto';
import { QUEUES } from '~/shared/queue';
import { RequestContext } from '~/shared/request-context/request-context.service';
import {
  buildTemplate,
  parseSheet,
  type RowError,
} from '~/shared/spreadsheet/spreadsheet';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import { AccessScope } from '~/modules/access-scope/access-scope.service';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';
import { AuditService } from '~/modules/audit/services/audit.service';
import type { ProvisionResult } from '~/modules/auth/services/invite.service';
import { FileService, type IncomingFile } from '~/modules/files/file.service';
import { MIME } from '~/modules/files/file-type';
import type { Job } from '~/modules/jobs/entities/job.entity';
import { JobService } from '~/modules/jobs/services/job.service';
import {
  CommitImportDto,
  FilterImportDto,
  StartImportDto,
} from '../dto/import.dto';
import {
  ImportBatch,
  type ImportRow,
  type ImportTotals,
} from '../entities/import.entity';
import { ImportMode, ImportStatus, ImportType } from '../enums/import.enum';
import { ImportRepository } from '../import.repository';
import type { ImportContext, Importer } from '../importers/importer';
import { MarksImporter } from '../importers/marks.importer';
import { StaffImporter } from '../importers/staff.importer';
import { StudentImporter } from '../importers/student.importer';

export const IMPORT_VALIDATE_JOB = 'validate';

const SHEET_NAMES: Record<ImportType, string> = {
  [ImportType.STUDENTS]: 'Students',
  [ImportType.STAFF]: 'Staff',
  [ImportType.MARKS]: 'Marks',
};
export const IMPORT_COMMIT_JOB = 'commit';

/**
 * Excel imports (PRD 6.2): template → upload → validation job (row-level
 * preview) → commit job. `all_or_nothing` saves everything in one
 * transaction or nothing; `valid_only` saves each valid row on its own
 * savepoint and reports the rest.
 */
@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(
    private readonly importRepo: ImportRepository,
    private readonly files: FileService,
    private readonly jobs: JobService,
    private readonly academicYears: AcademicYearService,
    private readonly scope: AccessScope,
    private readonly audit: AuditService,
    private readonly context: RequestContext,
    private readonly studentImporter: StudentImporter,
    private readonly staffImporter: StaffImporter,
    private readonly marksImporter: MarksImporter,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  /** The template workbook: headers, an example row, dropdowns. */
  async template(
    type: ImportType,
    markSheetId: string | null = null,
  ): Promise<Buffer> {
    const importer = await this.importer(type);
    const ctx: ImportContext = { academicYearId: null, markSheetId };
    await this.assertMay(importer, ctx);
    return buildTemplate(
      await importer.columns(ctx),
      SHEET_NAMES[type],
      importer.templateRows ? await importer.templateRows(ctx) : undefined,
    );
  }

  findFiltered(filter: FilterImportDto): Promise<Paginated<ImportBatch>> {
    const where: FindOptionsWhere<ImportBatch> = {};
    if (filter.type) where.type = filter.type;
    return this.importRepo.findFiltered(where, filter);
  }

  /** The import with every row, its status and errors (the preview). */
  findById(id: string): Promise<ImportBatch> {
    return this.importRepo.findByIdOrFail(id);
  }

  /** Stores the file, then validates it in a job. */
  async start(
    dto: StartImportDto,
    file: IncomingFile,
  ): Promise<{ import: ImportBatch; job: Job }> {
    const importer = await this.importer(dto.type);
    const markSheetId =
      dto.type === ImportType.MARKS ? (dto.markSheetId ?? null) : null;
    await this.assertMay(importer, { academicYearId: null, markSheetId });
    let academicYearId: string | null = null;
    if (dto.type === ImportType.STUDENTS) {
      academicYearId =
        dto.academicYearId ??
        (await this.academicYears.findCurrent())?.id ??
        null;
      if (!academicYearId) {
        throw new BadRequestException({
          message: 'Pick the session to enroll the students into',
          code: 'NO_CURRENT_SESSION',
        });
      }
      await this.academicYears.findById(academicYearId);
    }
    const stored = await this.files.upload(file, 'import');
    const batch = await this.importRepo.saveNew({
      type: dto.type,
      fileId: stored.id,
      status: ImportStatus.UPLOADED,
      mode: dto.mode ?? ImportMode.ALL_OR_NOTHING,
      academicYearId,
      markSheetId,
      totals: null,
      errors: [],
      rows: [],
      failure: null,
      createdBy: this.context.current().userId,
      committedAt: null,
    });
    const job = await this.jobs.start<{ importId: string }>({
      type: `imports.${dto.type}.validate`,
      queue: QUEUES.imports,
      name: IMPORT_VALIDATE_JOB,
      data: { importId: batch.id },
      options: { attempts: 1 },
    });
    return { import: batch, job };
  }

  /** Queues the commit of a validated import. */
  async startCommit(id: string, dto: CommitImportDto): Promise<Job> {
    const batch = await this.findById(id);
    await this.assertMay(await this.importer(batch.type), this.ctx(batch));
    if (batch.status !== ImportStatus.VALIDATED) {
      throw new ConflictException({
        message: `The import is ${batch.status}`,
        code: 'IMPORT_NOT_VALIDATED',
      });
    }
    const mode = dto.mode ?? batch.mode;
    const totals = batch.totals!;
    if (mode === ImportMode.ALL_OR_NOTHING && totals.invalid > 0) {
      throw new ConflictException({
        message: `${totals.invalid} row(s) have errors; fix them or import the valid rows only`,
        code: 'IMPORT_HAS_ERRORS',
      });
    }
    if (totals.valid === 0) {
      throw new ConflictException({
        message: 'There are no valid rows to import',
        code: 'IMPORT_EMPTY',
      });
    }
    await this.importRepo.updateFields(id, {
      status: ImportStatus.COMMITTING,
      mode,
    });
    return this.jobs.start<{ importId: string }>({
      type: `imports.${batch.type}.commit`,
      queue: QUEUES.imports,
      name: IMPORT_COMMIT_JOB,
      data: { importId: id },
      options: { attempts: 1 },
    });
  }

  // --- Job work ------------------------------------------------------------

  /** Parses and checks every row; the import becomes `validated`. */
  async validate(id: string): Promise<ImportTotals> {
    const batch = await this.findById(id);
    await this.importRepo.updateFields(id, { status: ImportStatus.VALIDATING });
    try {
      const importer = await this.importer(batch.type);
      const ctx = this.ctx(batch);
      const { buffer, mime } = await this.files.read(batch.fileId!);
      const parsed = await parseSheet(
        buffer,
        await importer.columns(ctx),
        mime === MIME.csv ? 'csv' : 'xlsx',
      );
      if (parsed.errors.some((e) => e.code === 'MISSING_COLUMN')) {
        return this.fail(
          id,
          'The file is missing required columns',
          parsed.errors,
        );
      }
      if (!parsed.rows.length) {
        return this.fail(id, 'The file has no data rows', []);
      }
      const formatErrors = groupByRow(parsed.errors);
      // Rows with format errors skip the data checks (values are partial).
      const checkable = parsed.rows.filter((r) => !formatErrors.has(r.row));
      const dataErrors = await importer.validate(checkable, ctx);
      const rows: ImportRow[] = parsed.rows.map((r) => {
        const errors = [
          ...(formatErrors.get(r.row) ?? []),
          ...(dataErrors.get(r.row) ?? []),
        ];
        return {
          row: r.row,
          values: r.values,
          status: errors.length ? 'invalid' : 'valid',
          errors,
        };
      });
      const totals: ImportTotals = {
        rows: rows.length,
        valid: rows.filter((r) => r.status === 'valid').length,
        invalid: rows.filter((r) => r.status === 'invalid').length,
      };
      await this.importRepo.updateFields(id, {
        status: ImportStatus.VALIDATED,
        rows,
        errors: rows.flatMap((r) => r.errors),
        totals,
      });
      return totals;
    } catch (err) {
      this.logger.error(`Import ${id} validation failed`, (err as Error).stack);
      return this.fail(id, 'The file could not be read', []);
    }
  }

  /**
   * Saves the valid rows (see the class comment for the modes). Account
   * emails go out after the commit.
   */
  async commit(id: string): Promise<ImportTotals> {
    const batch = await this.findById(id);
    const importer = await this.importer(batch.type);
    const ctx = this.ctx(batch);
    const rows = batch.rows;
    const mails: ProvisionResult[] = [];
    const allOrNothing = batch.mode === ImportMode.ALL_OR_NOTHING;

    try {
      await this.ds.runInTransaction(async () => {
        for (const row of rows) {
          if (row.status !== 'valid') continue;
          const rowMails: ProvisionResult[] = [];
          try {
            // A savepoint per row: a failure undoes only that row.
            row.result = await this.ds.runInTransaction(() =>
              importer.commitRow(row.values as never, ctx, rowMails),
            );
            row.status = 'committed';
            mails.push(...rowMails);
          } catch (err) {
            row.status = 'skipped';
            row.errors = [...row.errors, commitError(row.row, err)];
            if (allOrNothing) throw new RowFailed(row.row, err);
          }
        }
        await this.audit.record({
          action: AUDIT_ACTIONS.IMPORT_COMMITTED,
          entityType: 'import',
          entityId: id,
          after: {
            type: batch.type,
            committed: rows.filter((r) => r.status === 'committed').length,
          },
        });
      });
    } catch (err) {
      const failedRow = err instanceof RowFailed ? err.row : null;
      for (const row of rows) {
        if (row.status === 'committed') row.status = 'valid';
      }
      await this.importRepo.updateFields(id, {
        status: ImportStatus.FAILED,
        rows,
        errors: rows.flatMap((r) => r.errors),
        failure: failedRow
          ? `Row ${failedRow} could not be saved; nothing was imported`
          : 'The import could not be saved; nothing was imported',
      });
      throw err instanceof RowFailed ? err.cause : err;
    }

    for (const mail of mails) await mail.sendMail();
    const totals: ImportTotals = {
      ...batch.totals!,
      committed: rows.filter((r) => r.status === 'committed').length,
      skipped: rows.filter((r) => r.status !== 'committed').length,
    };
    await this.importRepo.updateFields(id, {
      status: ImportStatus.DONE,
      rows,
      errors: rows.flatMap((r) => r.errors),
      totals,
      committedAt: new Date(),
    });
    return totals;
  }

  // --- Helpers -------------------------------------------------------------

  private ctx(batch: ImportBatch): ImportContext {
    return {
      academicYearId: batch.academicYearId,
      markSheetId: batch.markSheetId,
    };
  }

  /** The importer of a type (same request scope, so same transaction). */
  private importer(type: ImportType): Promise<Importer> {
    const importers: Record<ImportType, Importer> = {
      [ImportType.STUDENTS]: this.studentImporter as unknown as Importer,
      [ImportType.STAFF]: this.staffImporter as unknown as Importer,
      [ImportType.MARKS]: this.marksImporter as unknown as Importer,
    };
    return Promise.resolve(importers[type]);
  }

  private async assertMay(
    importer: Importer,
    ctx?: ImportContext,
  ): Promise<void> {
    if (!(await this.scope.can(importer.permission))) {
      throw new ForbiddenException({
        message: `Importing ${importer.type} needs ${importer.permission}`,
        code: 'FORBIDDEN',
      });
    }
    if (ctx && importer.assertAccess) await importer.assertAccess(ctx);
  }

  private async fail(
    id: string,
    failure: string,
    errors: RowError[],
  ): Promise<ImportTotals> {
    await this.importRepo.updateFields(id, {
      status: ImportStatus.FAILED,
      failure,
      errors,
    });
    return { rows: 0, valid: 0, invalid: 0 };
  }
}

class RowFailed extends Error {
  constructor(
    readonly row: number,
    override readonly cause: unknown,
  ) {
    super(`Row ${row} failed`);
  }
}

function groupByRow(errors: RowError[]): Map<number, RowError[]> {
  const map = new Map<number, RowError[]>();
  for (const e of errors) map.set(e.row, [...(map.get(e.row) ?? []), e]);
  return map;
}

/** A save-time failure as a row error (the message users see). */
function commitError(row: number, err: unknown): RowError {
  const response = (err as { getResponse?: () => unknown }).getResponse?.();
  const body =
    typeof response === 'object' && response !== null
      ? (response as { message?: string; code?: string })
      : {};
  return {
    row,
    column: '',
    code: body.code ?? 'SAVE_FAILED',
    message: body.message ?? 'This row could not be saved',
  };
}
