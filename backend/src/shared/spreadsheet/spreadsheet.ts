import ExcelJS from 'exceljs';
import { Readable } from 'node:stream';

export type CellType = 'string' | 'number' | 'date' | 'boolean';

export interface SheetColumn<T> {
  key: keyof T & string;
  /** Header text in the workbook; matched case- and space-insensitively. */
  header: string;
  type?: CellType;
  required?: boolean;
  /** Allowed values; becomes a dropdown in the template. */
  options?: readonly string[];
  /** Shown in the template's example row. */
  example?: string | number;
  width?: number;
}

export interface RowError {
  /** 1-based row number as the user sees it in Excel. */
  row: number;
  column: string;
  /**
   * `REQUIRED`, `INVALID_NUMBER`, `INVALID_DATE`, `INVALID_BOOLEAN`,
   * `INVALID_OPTION` or `MISSING_COLUMN` from parsing; importers add their
   * own (`UNKNOWN_CLASS`, `DUPLICATE_IN_FILE`, …).
   */
  code: string;
  message: string;
}

export interface ParsedRow<T> {
  row: number;
  values: Partial<T>;
}

export interface ParseResult<T> {
  rows: ParsedRow<T>[];
  errors: RowError[];
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** An import template: bold headers, an example row, dropdowns for options. */
export async function buildTemplate<T>(
  columns: SheetColumn<T>[],
  sheetName = 'Data',
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.columns = columns.map((c) => ({
    header: c.required ? `${c.header} *` : c.header,
    key: c.key,
    width: c.width ?? Math.max(14, c.header.length + 4),
  }));
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  if (columns.some((c) => c.example !== undefined)) {
    ws.addRow(
      Object.fromEntries(columns.map((c) => [c.key, c.example ?? null])),
    );
  }
  columns.forEach((c, i) => {
    if (!c.options?.length) return;
    const letter = ws.getColumn(i + 1).letter;
    // Lists longer than 255 chars need a range; keep options short.
    for (let r = 2; r <= 1000; r++) {
      ws.getCell(`${letter}${r}`).dataValidation = {
        type: 'list',
        allowBlank: !c.required,
        formulae: [`"${c.options.join(',')}"`],
      };
    }
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/**
 * Reads the first sheet of an XLSX (or a CSV) into typed rows. Every
 * problem is collected with its row and column instead of throwing, so the
 * import preview can show them all. Empty rows are skipped.
 */
export async function parseSheet<T>(
  file: Buffer,
  columns: SheetColumn<T>[],
  format: 'xlsx' | 'csv' = 'xlsx',
): Promise<ParseResult<T>> {
  const wb = new ExcelJS.Workbook();
  const ws =
    format === 'csv'
      ? await wb.csv.read(Readable.from(file))
      : (await wb.xlsx.load(file as unknown as ArrayBuffer), wb.worksheets[0]);
  const errors: RowError[] = [];
  const rows: ParsedRow<T>[] = [];
  if (!ws) return { rows, errors };

  const headerIndex = new Map<string, number>();
  ws.getRow(1).eachCell((cell, col) => {
    headerIndex.set(norm(String(cell.text).replace(/\*$/, '')), col);
  });
  const positions = columns.map((c) => headerIndex.get(norm(c.header)));
  columns.forEach((c, i) => {
    if (positions[i] === undefined && c.required) {
      errors.push({
        row: 1,
        column: c.header,
        code: 'MISSING_COLUMN',
        message: `Column "${c.header}" is missing`,
      });
    }
  });
  if (errors.length) return { rows, errors };

  for (let r = 2; r <= ws.rowCount; r++) {
    const excelRow = ws.getRow(r);
    if (!excelRow.hasValues) continue;
    const values: Partial<T> = {};
    columns.forEach((c, i) => {
      const pos = positions[i];
      const cell = pos === undefined ? undefined : excelRow.getCell(pos);
      const result = convert(cell, c);
      if ('error' in result) {
        errors.push({ row: r, column: c.header, ...result.error });
      } else if (result.value !== undefined) {
        (values as Record<string, unknown>)[c.key] = result.value;
      }
    });
    rows.push({ row: r, values });
  }
  return { rows, errors };
}

/** Writes rows as a single-sheet XLSX with the given columns. */
export async function writeSheet<T>(
  columns: SheetColumn<T>[],
  rows: Partial<T>[],
  sheetName = 'Data',
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width ?? Math.max(14, c.header.length + 4),
  }));
  ws.getRow(1).font = { bold: true };
  ws.addRows(rows);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

type Converted =
  { value: unknown } | { error: Pick<RowError, 'code' | 'message'> };

function convert<T>(
  cell: ExcelJS.Cell | undefined,
  col: SheetColumn<T>,
): Converted {
  const raw = cell?.value;
  const text =
    raw === null || raw === undefined ? '' : String(cell!.text ?? '').trim();
  if (text === '') {
    return col.required
      ? { error: { code: 'REQUIRED', message: `${col.header} is required` } }
      : { value: undefined };
  }
  switch (col.type ?? 'string') {
    case 'number': {
      const n = typeof raw === 'number' ? raw : Number(text.replace(/,/g, ''));
      return Number.isFinite(n)
        ? { value: n }
        : {
            error: {
              code: 'INVALID_NUMBER',
              message: `${col.header} must be a number`,
            },
          };
    }
    case 'date': {
      const d = raw instanceof Date ? raw : parseDate(text);
      return d
        ? { value: d.toISOString().slice(0, 10) }
        : {
            error: {
              code: 'INVALID_DATE',
              message: `${col.header} must be a date (YYYY-MM-DD or DD/MM/YYYY)`,
            },
          };
    }
    case 'boolean': {
      const t = text.toLowerCase();
      if (['yes', 'y', 'true', '1'].includes(t)) return { value: true };
      if (['no', 'n', 'false', '0'].includes(t)) return { value: false };
      return {
        error: {
          code: 'INVALID_BOOLEAN',
          message: `${col.header} must be Yes or No`,
        },
      };
    }
    default:
      if (col.options && !col.options.includes(text)) {
        return {
          error: {
            code: 'INVALID_OPTION',
            message: `${col.header} must be one of: ${col.options.join(', ')}`,
          },
        };
      }
      return { value: text };
  }
}

/** `YYYY-MM-DD` or `DD/MM/YYYY` (the format schools in Bangladesh use). */
function parseDate(text: string): Date | null {
  let y: number, m: number, d: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (dmy) [d, m, y] = [Number(dmy[1]), Number(dmy[2]), Number(dmy[3])];
  else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
    ? date
    : null;
}
