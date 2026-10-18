import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { DayOfWeek } from '../enums/day-of-week.enum';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';

export class FilterTimetableDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @IsOptional()
  @IsUUID('4')
  academicYearId?: string;

  @IsOptional()
  @IsUUID('4')
  classId?: string;

  @IsOptional()
  @IsUUID('4')
  sectionId?: string;

  @IsOptional()
  @IsEnum(DayOfWeek)
  dayOfWeek?: DayOfWeek;

  @IsOptional()
  @IsUUID('4')
  employeeId?: string;
}
