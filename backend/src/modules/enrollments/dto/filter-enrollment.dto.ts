import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { StudentEnrollmentStatus } from '../enums/student-enrollment-status.enum';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';

export class FilterEnrollmentDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @IsOptional()
  @IsUUID('4')
  studentId?: string;

  @IsOptional()
  @IsUUID('4')
  academicYearId?: string;

  @IsOptional()
  @IsUUID('4')
  classId?: string;

  @IsOptional()
  @IsUUID('4')
  sectionId?: string;

  @IsOptional()
  @IsEnum(StudentEnrollmentStatus)
  status?: StudentEnrollmentStatus;
}
