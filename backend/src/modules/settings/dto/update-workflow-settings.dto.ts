import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsObject,
  IsString,
  MaxLength,
  ValidateNested,
  IsBoolean,
  IsIn,
  IsInt,
  IsMilitaryTime,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import {
  TIE_BREAKERS,
  type TieBreaker,
} from '~/modules/grading/engine/positions';

export class UpdateReportCardSettingsDto {
  @IsIn(['bn', 'en']) language?: 'bn' | 'en';
  @IsBoolean() showPosition?: boolean;
  @IsBoolean() showAttendance?: boolean;
  @IsBoolean() showRemarks?: boolean;

  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  signatures?: string[];
}

export class UpdateResultsSettingsDto {
  /** Require the Verified step between Submitted and Approved (PRD 6.9). */
  @IsBoolean() verifyStep?: boolean;

  /** Merit tie-breakers in order, each once. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(TIE_BREAKERS, { each: true })
  tieBreakers?: TieBreaker[];

  @IsObject()
  @ValidateNested()
  @Type(() => UpdateReportCardSettingsDto)
  reportCard?: UpdateReportCardSettingsDto;
}

export class UpdateAttendanceSettingsDto {
  @IsIn(['day', 'period']) mode?: 'day' | 'period';

  /** Days after which a record needs `attendance:edit_locked` (0 = same day). */
  @IsInt() @Min(0) @Max(365) lockAfterDays?: number;

  /** Local `HH:mm` by which registers are due, or null for no cutoff. */
  @IsOptional() @IsMilitaryTime() cutoffTime?: string | null;
}

export class UpdateFeesSettingsDto {
  /** 1–28, so every month has the day. */
  @IsInt() @Min(1) @Max(28) billingDay?: number;
  @IsInt() @Min(1) @Max(28) dueDay?: number;
  @IsInt() @Min(0) @Max(90) graceDays?: number;

  /** Days after the due date, ascending, e.g. `[3, 15]`. */
  @IsArray()
  @ArrayMaxSize(5)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(365, { each: true })
  reminderDays?: number[];

  @IsBoolean() blockResultsOnDues?: boolean;
}

export class UpdateSecuritySettingsDto {
  /**
   * Sign-ins not refreshed for this many minutes end (15 minutes to 30
   * days), or null for no idle limit.
   */
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(43_200)
  sessionIdleMinutes?: number | null;
}
