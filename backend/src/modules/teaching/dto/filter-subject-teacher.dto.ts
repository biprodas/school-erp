import { IsOptional, IsUUID } from 'class-validator';
import { FilterClassTeacherDto } from './filter-class-teacher.dto';

export class FilterSubjectTeacherDto extends FilterClassTeacherDto {
  @IsOptional()
  @IsUUID('4')
  classSubjectId?: string;

  /** Rows for this subject (any class subject of it). */
  @IsOptional()
  @IsUUID('4')
  subjectId?: string;
}
