import { PartialType } from '@nestjs/swagger';
import { CreateClassSubjectGroupDto } from './create-class-subject-group.dto';

/** Re-points an offering (e.g. fixes the class, group or year). */
export class UpdateClassSubjectGroupDto extends PartialType(
  CreateClassSubjectGroupDto,
) {}
