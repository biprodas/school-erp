import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { IsDateOnly } from '~/common/decorators/is-date-only.decorator';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { StudentLeaveStatus } from '../enums/attendance.enum';

export class CreateStudentLeaveDto {
  /** An active enrollment (the student's section in the session). */
  @IsUUID('4')
  enrollmentId: string;

  @IsDateOnly()
  fromDate: string;

  /** Inclusive; defaults to `fromDate`. */
  @IsOptional()
  @IsDateOnly()
  toDate?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}

export class DecideStudentLeaveDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class FilterStudentLeaveDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(StudentLeaveStatus)
  status?: StudentLeaveStatus;

  @IsOptional()
  @IsUUID('4')
  studentId?: string;

  @IsOptional()
  @IsUUID('4')
  sectionId?: string;

  /** Requests that end on or after this day. */
  @IsOptional()
  @IsDateOnly()
  from?: string;

  /** Requests that start on or before this day. */
  @IsOptional()
  @IsDateOnly()
  to?: string;
}
