import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { StudentGender } from '../enums/student-gender.enum';
import { StudentStatus } from '../enums/student-status.enum';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';

export class FilterStudentDto extends PaginationQueryDto {
  /**
   * Name (English or Bangla, partial), student ID, or the phone of the
   * student or a guardian.
   */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsUUID('4')
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  admissionNumber?: string;

  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;

  @IsOptional()
  @IsEnum(StudentGender)
  gender?: StudentGender;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  religion?: string;

  /**
   * Session for the class/section filters (default: the current one).
   */
  @IsOptional()
  @IsUUID('4')
  academicYearId?: string;

  @IsOptional()
  @IsUUID('4')
  classId?: string;

  @IsOptional()
  @IsUUID('4')
  sectionId?: string;
}
