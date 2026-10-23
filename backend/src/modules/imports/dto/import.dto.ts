import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { ImportMode, ImportType } from '../enums/import.enum';

/** Form fields sent with the multipart `file` (`.xlsx` or `.csv`). */
export class StartImportDto {
  @IsEnum(ImportType)
  type: ImportType;

  @IsOptional()
  @IsEnum(ImportMode)
  mode?: ImportMode;

  /** Students: the session to enroll into (default: the current one). */
  @IsOptional()
  @IsUUID('4')
  academicYearId?: string;
}

export class CommitImportDto {
  /** Overrides the mode chosen at upload. */
  @IsOptional()
  @IsEnum(ImportMode)
  mode?: ImportMode;
}

export class FilterImportDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ImportType)
  type?: ImportType;
}
