import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { StudentEnrollmentStatus } from '../enums/student-enrollment-status.enum';

export class FilterEnrollmentDto {
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
