import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateClassSubjectDto } from './create-class-subject.dto';

/** The class, subject and year identify the row and cannot change. */
export class UpdateClassSubjectDto extends PartialType(
  OmitType(CreateClassSubjectDto, [
    'classId',
    'subjectId',
    'academicYearId',
  ] as const),
) {}
