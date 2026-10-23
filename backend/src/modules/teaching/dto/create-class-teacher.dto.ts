import { IsBoolean, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { IsDateOnly } from '~/common/decorators/is-date-only.decorator';

export class CreateClassTeacherDto {
  @IsUUID('4')
  @IsNotEmpty()
  sectionId: string;

  @IsUUID('4')
  @IsNotEmpty()
  employeeId: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  /** Defaults to the session's first day; must be inside the session. */
  @IsOptional()
  @IsDateOnly()
  effectiveFrom?: string;
}
