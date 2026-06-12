import { IsOptional, IsUUID } from 'class-validator';

export class FilterClassSubjectDto {
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
}
