import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { DayOfWeek } from '../enums/day-of-week.enum';

export class FilterTimetableDto {
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
