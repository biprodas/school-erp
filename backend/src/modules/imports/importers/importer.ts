import type { ProvisionResult } from '~/modules/auth/services/invite.service';
import type { PermissionKey } from '~/modules/rbac/permissions.catalog';
import type {
  ParsedRow,
  RowError,
  SheetColumn,
} from '~/shared/spreadsheet/spreadsheet';
import type { ImportType } from '../enums/import.enum';

export interface ImportContext {
  /** Students: the session they are enrolled in. */
  academicYearId: string | null;
}

/**
 * One import type: its template columns, its row checks against the
 * school's data, and how one row is saved. Request-scoped (it uses the
 * feature services); jobs resolve it for the school.
 */
export interface Importer<T = Record<string, unknown>> {
  readonly type: ImportType;
  /** Needed to upload, validate and commit this type. */
  readonly permission: PermissionKey;
  columns(ctx: ImportContext): Promise<SheetColumn<T>[]>;
  /** Errors per row number (beyond the format errors of `parseSheet`). */
  validate(
    rows: ParsedRow<T>[],
    ctx: ImportContext,
  ): Promise<Map<number, RowError[]>>;
  /**
   * Saves one validated row inside the caller's transaction; account
   * emails to send after the commit go into `mails`.
   */
  commitRow(
    values: T,
    ctx: ImportContext,
    mails: ProvisionResult[],
  ): Promise<Record<string, unknown>>;
}

/** Adds an error to a row's list. */
export function addError(
  errors: Map<number, RowError[]>,
  row: number,
  column: string,
  code: string,
  message: string,
): void {
  const list = errors.get(row) ?? [];
  list.push({ row, column, code, message });
  errors.set(row, list);
}

export const key = (s: string) => s.trim().toLowerCase();
