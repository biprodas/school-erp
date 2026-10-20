import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

/**
 * Which students get their own portal login (guardians always do). Changes
 * apply to accounts created from then on, and are re-checked at promotion.
 */
export class UpdatePortalSettingsDto {
  @IsBoolean() studentAccounts?: boolean;

  /** Classes at this level or above qualify (default 6). */
  @IsInt() @Min(0) @Max(20) studentMinLevel?: number;

  /** When non-empty, exactly these classes qualify instead. */
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  studentClassIds?: string[];
}
