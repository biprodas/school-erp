import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { IsDateOnly } from '~/common/decorators/is-date-only.decorator';
import { HolidayType } from '../enums/holiday-type.enum';

export class CreateHolidayDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  nameBn?: string | null;

  @IsEnum(HolidayType)
  type: HolidayType;

  @IsDateOnly()
  dateFrom: string;

  /** Inclusive; defaults to `dateFrom`. */
  @IsOptional()
  @IsDateOnly()
  dateTo?: string;

  /** Only these classes; omit or leave empty for the whole school. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  classIds?: string[];
}
