import { Type } from 'class-transformer';
import {
  IsDefined,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { IsDateOnly } from '~/common/decorators/is-date-only.decorator';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export class DailySummaryQueryDto {
  /** Defaults to today. */
  @IsOptional()
  @IsDateOnly()
  date?: string;

  /** Defaults to the current session. */
  @IsOptional()
  @IsUUID('4')
  academicYearId?: string;
}

export class MonthlyRegisterQueryDto {
  @IsDefined()
  @IsUUID('4')
  sectionId: string;

  /** `YYYY-MM`. */
  @IsDefined()
  @Matches(MONTH, { message: 'month must be YYYY-MM' })
  month: string;
}

export class MonthlyRegisterPdfDto extends MonthlyRegisterQueryDto {
  @IsOptional()
  @IsIn(['A4-landscape', 'Legal-landscape'])
  paper?: 'A4-landscape' | 'Legal-landscape';
}

/** A range of school days in a session, for the student lists. */
export class AttendanceRangeQueryDto {
  /** Defaults to the current session. */
  @IsOptional()
  @IsUUID('4')
  academicYearId?: string;

  /** Defaults to the session's first day. */
  @IsOptional()
  @IsDateOnly()
  from?: string;

  /** Defaults to today (or the session's last day, if earlier). */
  @IsOptional()
  @IsDateOnly()
  to?: string;

  @IsOptional()
  @IsUUID('4')
  classId?: string;

  @IsOptional()
  @IsUUID('4')
  sectionId?: string;
}

export class DefaultersQueryDto extends AttendanceRangeQueryDto {
  /** Students below this percentage (default 75). */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  threshold?: number;
}

export class LateComersQueryDto extends AttendanceRangeQueryDto {
  /** Students late at least this many days (default 1). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minLate?: number;
}
