import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
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
import { EmployeeGender } from '../enums/employee-gender.enum';
import { EmployeeStatus } from '../enums/employee-status.enum';

export class CreateEmployeeUserDto {
  @IsEmail()
  @IsNotEmpty()
  @IsDefined()
  email: string;

  @IsString()
  @MinLength(6)
  @IsDefined()
  password: string;

  /** RBAC roles to assign to the provisioned login (e.g. the teacher role). */
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  roleIds: string[];
}

export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  employeeNumber: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsEnum(EmployeeGender)
  gender?: EmployeeGender;

  @IsOptional()
  @IsDateString()
  dob?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsDateString()
  joiningDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  qualification?: string;

  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @IsOptional()
  @IsUUID('4')
  departmentId?: string;

  @IsOptional()
  @IsUUID('4')
  designationId?: string;

  /** Attach an existing tenant user as the employee's login account. */
  @IsOptional()
  @IsUUID('4')
  userId?: string;

  /** Provision a new tenant user (with the given roles) and link it. */
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateEmployeeUserDto)
  createUser?: CreateEmployeeUserDto;
}
