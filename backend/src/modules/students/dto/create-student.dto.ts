import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { IsDateOnly } from '~/common/decorators/is-date-only.decorator';
import { IsPhone } from '~/common/identity/is-phone.decorator';
import { AdmissionType } from '../enums/admission-type.enum';
import { BloodGroup } from '../enums/blood-group.enum';
import { StudentGender } from '../enums/student-gender.enum';

/**
 * A new student starts `active` (admissions, with `applicant`, come in
 * PRD 6.5); the status then changes through `POST /students/:id/status`.
 */
export class CreateStudentDto {
  /**
   * The student ID. Generated from `numbering.studentId` when left out;
   * typing one is allowed only with `numbering.allowManualStudentId`.
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  admissionNumber?: string;

  /** Class of admission; needed when the ID pattern uses `{CLASS}`. */
  @IsOptional()
  @IsUUID('4')
  classId?: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  nameBn?: string;

  @IsOptional()
  @IsDateOnly()
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

  /** 17-digit birth registration number. */
  @IsOptional()
  @Matches(/^\d{17}$/, { message: 'birthRegNo must be 17 digits' })
  birthRegNo?: string;

  @IsOptional()
  @IsEnum(BloodGroup)
  bloodGroup?: BloodGroup;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  previousSchool?: string;

  /** The student's own; used for a portal account when the class qualifies. */
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsPhone()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsDateOnly()
  admissionDate?: string;

  @IsOptional()
  @IsEnum(AdmissionType)
  admissionType?: AdmissionType;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  rfidCardNo?: string;
}
