import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator';
import { DayOfWeek } from '../enums/day-of-week.enum';

export class CreateTimetableDto {
  @IsUUID('4')
  @IsNotEmpty()
  academicYearId: string;

  @IsUUID('4')
  @IsNotEmpty()
  classId: string;

  @IsUUID('4')
  @IsNotEmpty()
  sectionId: string;

  @IsEnum(DayOfWeek)
  dayOfWeek: DayOfWeek;

  @IsUUID('4')
  @IsNotEmpty()
  periodId: string;

  @IsUUID('4')
  @IsNotEmpty()
  subjectId: string;

  @IsUUID('4')
  @IsNotEmpty()
  employeeId: string;
}
