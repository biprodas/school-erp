import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { ClassSubjectType } from '../enums/class-subject-type.enum';

export class FilterClassSubjectDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @IsOptional()
  @IsUUID('4')
  classId?: string;

  @IsOptional()
  @IsUUID('4')
  subjectId?: string;

  @IsOptional()
  @IsUUID('4')
  academicYearId?: string;

  @IsOptional()
  @IsUUID('4')
  subjectGroupId?: string;

  @IsOptional()
  @IsEnum(ClassSubjectType)
  subjectType?: ClassSubjectType;
}
