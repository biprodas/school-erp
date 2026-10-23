import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { IsDateOnly } from '~/common/decorators/is-date-only.decorator';

/** Move to another section (or shift) of the same class and session. */
export class TransferEnrollmentDto {
  @IsUUID('4')
  @IsNotEmpty()
  sectionId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  /** Defaults to today (school time zone). */
  @IsOptional()
  @IsDateOnly()
  effectiveDate?: string;

  /** Roll in the new section; else kept when free there, otherwise cleared. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  rollNo?: string;

  /** Into a full section; needs `enrollments:override_capacity`. */
  @IsOptional()
  @IsBoolean()
  overrideCapacity?: boolean;
}
