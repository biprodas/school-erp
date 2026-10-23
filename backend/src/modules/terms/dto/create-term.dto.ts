import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { IsDateOnly } from '~/common/decorators/is-date-only.decorator';

export class CreateTermDto {
  @IsUUID('4')
  @IsNotEmpty()
  academicYearId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  /** Inside the session's dates. */
  @IsDateOnly()
  startDate: string;

  @IsDateOnly()
  endDate: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
