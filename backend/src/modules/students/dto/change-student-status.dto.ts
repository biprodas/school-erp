import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsDateOnly } from '~/common/decorators/is-date-only.decorator';
import { StudentStatus } from '../enums/student-status.enum';

export class ChangeStudentStatusDto {
  @IsEnum(StudentStatus)
  status: StudentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  /** Defaults to today (school time zone). */
  @IsOptional()
  @IsDateOnly()
  effectiveDate?: string;
}
