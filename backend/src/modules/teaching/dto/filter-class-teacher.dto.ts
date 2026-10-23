import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { IsDateOnly } from '~/common/decorators/is-date-only.decorator';

export const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
};

export class FilterClassTeacherDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @IsOptional()
  @IsUUID('4')
  sectionId?: string;

  @IsOptional()
  @IsUUID('4')
  employeeId?: string;

  /** Sections of this session. */
  @IsOptional()
  @IsUUID('4')
  academicYearId?: string;

  /** Sections of this class. */
  @IsOptional()
  @IsUUID('4')
  classId?: string;

  /** `true`: only current rows; `false`: only ended ones (history). */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  current?: boolean;

  /** Rows in effect on this day (who was in charge then). */
  @IsOptional()
  @IsDateOnly()
  on?: string;
}
