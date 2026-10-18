import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateEnrollmentDto } from './create-enrollment.dto';

/** The student and year identify the enrollment and cannot change. */
export class UpdateEnrollmentDto extends PartialType(
  OmitType(CreateEnrollmentDto, ['studentId', 'academicYearId'] as const),
) {}
