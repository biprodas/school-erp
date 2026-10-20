import {
  IsBoolean,
  IsIn,
  IsInt,
  IsMilitaryTime,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class UpdateResultsSettingsDto {
  /** Require the Verified step between Submitted and Approved (PRD 6.9). */
  @IsBoolean() verifyStep?: boolean;
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
  @IsInt() @Min(0) @Max(90) graceDays?: number;
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
