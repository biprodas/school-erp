import { IsIn, IsOptional } from 'class-validator';
import { FilterStudentDto } from './filter-student.dto';

export const EXPORT_FORMATS = ['xlsx', 'pdf'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/** `POST /students/export`: the list filters plus a format. */
export class ExportStudentsDto extends FilterStudentDto {
  @IsOptional()
  @IsIn(EXPORT_FORMATS)
  format?: ExportFormat;
}
