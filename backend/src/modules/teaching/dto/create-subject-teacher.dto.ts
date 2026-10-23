import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { IsDateOnly } from '~/common/decorators/is-date-only.decorator';

export class CreateSubjectTeacherDto {
  @IsUUID('4')
  @IsNotEmpty()
  sectionId: string;

  /** A subject of the section's class in the section's session. */
  @IsUUID('4')
  @IsNotEmpty()
  classSubjectId: string;

  @IsUUID('4')
  @IsNotEmpty()
  employeeId: string;

  /** Defaults to the session's first day; must be inside the session. */
  @IsOptional()
  @IsDateOnly()
  effectiveFrom?: string;
}
