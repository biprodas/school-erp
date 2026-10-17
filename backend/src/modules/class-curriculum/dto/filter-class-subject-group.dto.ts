import { IsOptional, IsUUID } from 'class-validator';

export class FilterClassSubjectGroupDto {
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @IsOptional()
  @IsUUID('4')
  classId?: string;

  @IsOptional()
  @IsUUID('4')
  subjectGroupId?: string;

  @IsOptional()
  @IsUUID('4')
  academicYearId?: string;
}
