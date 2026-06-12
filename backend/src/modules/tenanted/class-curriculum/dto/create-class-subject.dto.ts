import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateClassSubjectDto {
  @IsUUID('4')
  @IsNotEmpty()
  classId: string;

  @IsUUID('4')
  @IsNotEmpty()
  subjectId: string;

  @IsUUID('4')
  @IsNotEmpty()
  academicYearId: string;

  @IsOptional()
  @IsBoolean()
  isCompulsory?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  weeklyClasses?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  passMarks?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  fullMarks?: number;
}
