import { IsDefined, IsIn, IsObject, IsOptional } from 'class-validator';

export const REPORT_KEYS = [
  'fees.dues',
  'fees.defaulters',
  'attendance.defaulters',
  'attendance.late-comers',
] as const;
export type ReportKey = (typeof REPORT_KEYS)[number];

/**
 * A large report as Excel (a job). `params` are the report's own query
 * filters, e.g. `{ classId, threshold }`.
 */
export class ReportExportDto {
  @IsDefined()
  @IsIn(REPORT_KEYS)
  report: ReportKey;

  @IsOptional()
  @IsObject()
  params?: Record<string, string | number>;
}
