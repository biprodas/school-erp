import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { IsDateOnly } from '~/common/decorators/is-date-only.decorator';

/** Which register: a day (default today) and, in period mode, a period. */
export class RegisterQueryDto {
  @IsOptional()
  @IsDateOnly()
  date?: string;

  /** Required in period mode, refused in day mode. */
  @IsOptional()
  @IsUUID('4')
  periodId?: string;
}

export class SubmissionStatusQueryDto extends RegisterQueryDto {
  /** Defaults to the current session. */
  @IsOptional()
  @IsUUID('4')
  academicYearId?: string;
}

export class AttendanceEntryDto {
  @IsDefined()
  @IsUUID('4')
  enrollmentId: string;

  /** A status code from `GET /attendance/statuses`. */
  @IsDefined()
  @Matches(/^[a-z][a-z0-9_]{1,15}$/, { message: 'status must be a code' })
  status: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  remark?: string | null;
}

/**
 * The exceptions only: students left out are Present on a new register
 * (Leave when on approved leave) and keep their status on a taken one.
 */
export class SubmitAttendanceDto {
  @IsDefined()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => AttendanceEntryDto)
  records: AttendanceEntryDto[];

  /** Required when a recorded status changes (a correction). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  /** The client's id for this submission (offline sync, Phase 1b). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  clientRequestId?: string;
}
