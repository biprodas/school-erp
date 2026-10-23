import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateStudentDto } from './create-student.dto';

/**
 * Status changes go through `POST /students/:id/status`, photos through
 * `POST /students/:id/photo`; the ID changes only where typing it is
 * allowed.
 */
export class UpdateStudentDto extends PartialType(
  OmitType(CreateStudentDto, ['classId'] as const),
) {}
