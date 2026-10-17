import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { StudentStatus } from '../enums/student-status.enum';

export class FilterStudentDto {
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  admissionNumber?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;

  @IsOptional()
  @IsUUID('4')
  userId?: string;
}
