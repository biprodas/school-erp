import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccessScope } from '~/modules/access-scope/access-scope.service';
import { MarkSheetStatus } from '~/modules/exams/enums/exam.enum';
import { MarkSheetService } from '~/modules/exams/services/mark-sheet.service';
import type { MarkEntryDto } from '~/modules/exams/dto/mark-sheet.dto';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import type {
  ParsedRow,
  RowError,
  SheetColumn,
} from '~/shared/spreadsheet/spreadsheet';
import { ImportType } from '../enums/import.enum';
import { addError, key, type ImportContext, type Importer } from './importer';

/** A row: the student, then one cell per component (`c:<componentId>`). */
export type MarksImportRow = Record<string, string | number | undefined> & {
  studentId: string;
};

const ABSENT = new Set(['ab', 'a', 'absent']);
const EXEMPT = new Set(['ex', 'exempt']);
const componentKey = (id: string) => `c:${id}`;

type Cell = Pick<MarkEntryDto, 'value' | 'absent' | 'exempt'>;

/** A cell's text as a mark, `AB` (absent) or `EX` (exempt); null = invalid. */
function parseCell(raw: unknown, fullMarks: number): Cell | null {
  const text = String(raw).trim().toLowerCase();
  if (ABSENT.has(text)) return { value: null, absent: true, exempt: false };
  if (EXEMPT.has(text)) return { value: null, absent: false, exempt: true };
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0 || value > fullMarks) return null;
  if (Math.round(value * 100) !== value * 100) return null;
  return { value, absent: false, exempt: false };
}

/**
 * One mark sheet's marks from Excel (PRD 6.9): the template lists the
 * sheet's students with a column per component, prefilled with what is
 * entered. Cells take a mark, `AB` or `EX`; empty cells are left alone.
 * Saved through `MarkSheetService.saveEntries`, so the sheet must be a
 * draft and the importer must teach the subject.
 */
@Injectable()
export class MarksImporter implements Importer<MarksImportRow> {
  readonly type = ImportType.MARKS;
  readonly permission = PERMISSIONS.RESULTS_ENTER;

  constructor(
    private readonly sheets: MarkSheetService,
    private readonly scope: AccessScope,
  ) {}

  async assertAccess(ctx: ImportContext): Promise<void> {
    if (!ctx.markSheetId) {
      throw new BadRequestException({
        message: 'Pick the mark sheet to import into',
        code: 'MARK_SHEET_REQUIRED',
      });
    }
    const sheet = await this.sheets.findById(ctx.markSheetId);
    const allowed = await this.scope.canAccessSubject(
      PERMISSIONS.RESULTS_ENTER,
      {
        sectionId: sheet.sectionId,
        classSubjectId: sheet.examSubject!.classSubjectId,
      },
    );
    if (!allowed)
      throw new NotFoundException(`Mark sheet "${sheet.id}" not found`);
    if (sheet.status !== MarkSheetStatus.DRAFT) {
      throw new ConflictException({
        message: `The sheet is ${sheet.status}`,
        code: 'MARK_SHEET_LOCKED',
      });
    }
  }

  async columns(ctx: ImportContext): Promise<SheetColumn<MarksImportRow>[]> {
    const grid = await this.grid(ctx);
    return [
      { key: 'studentId', header: 'Student ID', required: true, width: 16 },
      { key: 'roll', header: 'Roll', width: 8 },
      { key: 'name', header: 'Name', width: 28 },
      ...grid.subject.components.map((c) => ({
        key: componentKey(c.id),
        header: `${c.component.toUpperCase()} (${c.fullMarks})`,
      })),
    ];
  }

  /** The sheet's students with what is already entered. */
  async templateRows(ctx: ImportContext): Promise<Partial<MarksImportRow>[]> {
    const grid = await this.grid(ctx);
    return grid.students.map((s) => {
      const row: Partial<MarksImportRow> = {
        studentId: s.admissionNumber,
        roll: s.rollNo ?? undefined,
        name: s.name,
      };
      for (const c of grid.subject.components) {
        const cell = s.marks[c.id];
        row[componentKey(c.id)] = !cell
          ? undefined
          : cell.absent
            ? 'AB'
            : cell.exempt
              ? 'EX'
              : (cell.value ?? undefined);
      }
      return row;
    });
  }

  async validate(
    rows: ParsedRow<MarksImportRow>[],
    ctx: ImportContext,
  ): Promise<Map<number, RowError[]>> {
    const errors = new Map<number, RowError[]>();
    const grid = await this.grid(ctx);
    const students = new Map(
      grid.students.map((s) => [key(s.admissionNumber), s]),
    );
    const seen = new Set<string>();
    for (const { row, values } of rows) {
      const id = key(String(values.studentId ?? ''));
      if (!students.has(id)) {
        addError(
          errors,
          row,
          'Student ID',
          'UNKNOWN_STUDENT',
          'Not a student of this mark sheet',
        );
      } else if (seen.has(id)) {
        addError(
          errors,
          row,
          'Student ID',
          'DUPLICATE_IN_FILE',
          'The student appears twice',
        );
      }
      seen.add(id);
      for (const c of grid.subject.components) {
        const raw = values[componentKey(c.id)];
        if (raw === undefined || raw === '') continue;
        if (!parseCell(raw, c.fullMarks)) {
          addError(
            errors,
            row,
            `${c.component.toUpperCase()} (${c.fullMarks})`,
            'INVALID_MARK',
            `A mark from 0 to ${c.fullMarks}, AB or EX`,
          );
        }
      }
    }
    return errors;
  }

  async commitRow(values: MarksImportRow, ctx: ImportContext) {
    const grid = await this.grid(ctx);
    const student = grid.students.find(
      (s) => key(s.admissionNumber) === key(String(values.studentId)),
    )!;
    const entries: MarkEntryDto[] = [];
    for (const c of grid.subject.components) {
      const raw = values[componentKey(c.id)];
      if (raw === undefined || raw === '') continue;
      entries.push({
        enrollmentId: student.enrollmentId,
        componentId: c.id,
        ...parseCell(raw, c.fullMarks)!,
      });
    }
    await this.sheets.saveEntries(ctx.markSheetId!, entries);
    return { enrollmentId: student.enrollmentId, cells: entries.length };
  }

  private gridCache?: Promise<Awaited<ReturnType<MarkSheetService['grid']>>>;

  /** The sheet's grid, read once per job or request. */
  private grid(ctx: ImportContext) {
    this.gridCache ??= this.sheets.grid(ctx.markSheetId!);
    return this.gridCache;
  }
}
