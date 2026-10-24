import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { IsDateOnly } from '~/common/decorators/is-date-only.decorator';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { HolidayType } from '../enums/holiday-type.enum';

export class FilterHolidayDto extends PaginationQueryDto {
  /** Holidays that end on or after this day. */
  @IsOptional()
  @IsDateOnly()
  from?: string;

  /** Holidays that start on or before this day. */
  @IsOptional()
  @IsDateOnly()
  to?: string;

  @IsOptional()
  @IsEnum(HolidayType)
  type?: HolidayType;

  /** Holidays that apply to this class (school-wide ones included). */
  @IsOptional()
  @IsUUID('4')
  classId?: string;
}
