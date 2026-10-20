import { PartialType } from '@nestjs/swagger';
import { CreateSubjectTeacherDto } from './create-subject-teacher.dto';

/** Re-points an assignment (e.g. fixes the teacher or section). */
export class UpdateSubjectTeacherDto extends PartialType(
  CreateSubjectTeacherDto,
) {}
