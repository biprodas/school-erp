import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { IsDateOnly } from '~/common/decorators/is-date-only.decorator';

/**
 * `PATCH` on a current assignment. A new `employeeId` hands it over: the
 * row ends the day before `effectiveFrom` (default today) and a new one
 * starts that day, so history keeps the previous teacher. Handing over on
 * the row's own first day re-points it instead (it never took effect).
 * Without `employeeId`, `effectiveFrom` corrects the row's first day.
 */
export class ChangeAssignmentDto {
  @IsOptional()
  @IsUUID('4')
  employeeId?: string;

  @IsOptional()
  @IsDateOnly()
  effectiveFrom?: string;
}

export class ChangeClassTeacherDto extends ChangeAssignmentDto {
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

/** `POST …/:id/end`: the last day in charge (default today). */
export class EndAssignmentDto {
  @IsOptional()
  @IsDateOnly()
  effectiveTo?: string;
}
