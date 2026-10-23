import { OmitType, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { StudentEnrollmentStatus } from '../enums/student-enrollment-status.enum';
import { CreateEnrollmentDto } from './create-enrollment.dto';

/**
 * Corrections (class, section, roll, group). The student and year identify
 * the enrollment; moving between sections is `POST …/transfer`, which keeps
 * history.
 */
export class UpdateEnrollmentDto extends PartialType(
  OmitType(CreateEnrollmentDto, ['studentId', 'academicYearId'] as const),
) {
  @IsOptional()
  @IsEnum(StudentEnrollmentStatus)
  status?: StudentEnrollmentStatus;
}
