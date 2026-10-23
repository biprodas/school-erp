import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { IsPhone } from '~/common/identity/is-phone.decorator';
import { EmployeeGender } from '../enums/employee-gender.enum';
import { EmployeeStatus } from '../enums/employee-status.enum';
import { EmploymentType } from '../enums/employment-type.enum';

export class CreateEmployeeDto {
  /** Generated from the school's `numbering.employeeId` pattern if left out. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  employeeNumber?: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  nameBn?: string;

  /** Used by `POST /employees/:id/invite`. */
  @IsOptional()
  @IsEmail()
  email?: string;

  /** Used by `POST /employees/:id/invite` when there is no email. */
  @IsOptional()
  @IsPhone()
  phone?: string;

  /** Bangladesh NID: 10, 13 or 17 digits. Stored encrypted. */
  @IsOptional()
  @Matches(/^(\d{10}|\d{13}|\d{17})$/, {
    message: 'nid must be 10, 13 or 17 digits',
  })
  nid?: string;

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
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @IsOptional()
  @IsUUID('4')
  departmentId?: string;

  @IsOptional()
  @IsUUID('4')
  designationId?: string;

  /**
   * Link an existing member of the school as the employee's login. New
   * logins come from `POST /employees/:id/invite`.
   */
  @IsOptional()
  @IsUUID('4')
  userId?: string;
}
