import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { AdmissionType } from '../enums/admission-type.enum';
import { StudentGender } from '../enums/student-gender.enum';
import { StudentStatus } from '../enums/student-status.enum';

export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  admissionNumber?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsDateString()
  dob?: string;

  @IsOptional()
  @IsEnum(StudentGender)
  gender?: StudentGender;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  religion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  nationality?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsDateString()
  admissionDate?: string;

  @IsOptional()
  @IsEnum(AdmissionType)
  admissionType?: AdmissionType;

  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;

  @IsOptional()
  @IsUUID('4')
  userId?: string;
}
