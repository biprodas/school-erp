import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateClassTeacherDto } from './create-class-teacher.dto';

/** The class-section, teacher and year identify the row and cannot change. */
export class UpdateClassTeacherDto extends PartialType(
  OmitType(CreateClassTeacherDto, [
    'classId',
    'sectionId',
    'employeeId',
    'academicYearId',
  ] as const),
) {}
