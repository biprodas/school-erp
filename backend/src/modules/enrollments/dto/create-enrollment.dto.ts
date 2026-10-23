import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

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

  /** A section of `classId` in `academicYearId`. */
  @IsUUID('4')
  @IsNotEmpty()
  sectionId: string;

  /** A group the class offers in the session (Class 9–10 streams). */
  @IsOptional()
  @IsUUID('4')
  subjectGroupId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  rollNo?: string;

  /** Into a full section; needs `enrollments:override_capacity`. */
  @IsOptional()
  @IsBoolean()
  overrideCapacity?: boolean;
}
