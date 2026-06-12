import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { StudentEnrollmentStatus } from '../enums/student-enrollment-status.enum';

export class CreateEnrollmentDto {
  @IsUUID('4')
  @IsNotEmpty()
  studentId: string;

  @IsUUID('4')
  @IsNotEmpty()
  academicYearId: string;

  @IsUUID('4')
  @IsNotEmpty()
  classId: string;

  @IsUUID('4')
  @IsNotEmpty()
  sectionId: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  rollNo?: string;

  @IsOptional()
  @IsEnum(StudentEnrollmentStatus)
  status?: StudentEnrollmentStatus;
}
