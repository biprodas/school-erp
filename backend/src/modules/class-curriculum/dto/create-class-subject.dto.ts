import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { ClassSubjectType } from '../enums/class-subject-type.enum';
import { CreateClassSubjectComponentDto } from './class-subject-component.dto';

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

  /** Defaults to compulsory. */
  @IsOptional()
  @IsEnum(ClassSubjectType)
  subjectType?: ClassSubjectType;

  /** The group (stream) the subject belongs to in this class. */
  @IsOptional()
  @IsUUID('4')
  subjectGroupId?: string | null;

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

  /** Components created with the subject (one per kind). */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateClassSubjectComponentDto)
  components?: CreateClassSubjectComponentDto[];
}
