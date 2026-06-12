import { Type } from 'class-transformer';
import {
  IsDateString,
  IsDefined,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { StudentGender } from '../enums/student-gender.enum';
import { StudentStatus } from '../enums/student-status.enum';

export class CreateStudentUserDto {
  @IsEmail()
  @IsNotEmpty()
  @IsDefined()
  email: string;

  @IsString()
  @MinLength(6)
  @IsDefined()
  password: string;
}

export class CreateStudentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  admissionNumber: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsOptional()
  @IsDateString()
  dob?: string;

  @IsOptional()
  @IsEnum(StudentGender)
  gender?: StudentGender;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;

  /** Attach an existing tenant user as the student's login account. */
  @IsOptional()
  @IsUUID('4')
  userId?: string;

  /** Provision a new tenant user (with the 'student' role) and link it. */
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateStudentUserDto)
  createUser?: CreateStudentUserDto;
}
