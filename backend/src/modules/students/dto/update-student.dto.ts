import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateStudentDto } from './create-student.dto';

/** Logins are only created together with the student. */
export class UpdateStudentDto extends PartialType(
  OmitType(CreateStudentDto, ['createUser'] as const),
) {}
