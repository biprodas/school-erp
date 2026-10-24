import { OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsDateOnly } from '~/common/decorators/is-date-only.decorator';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { SubjectComponent } from '~/modules/class-curriculum/enums/subject-component.enum';
import { ExamStatus } from '../enums/exam.enum';

export class CreateExamTypeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  defaultWeight?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateExamTypeDto extends PartialType(CreateExamTypeDto) {}

export class CreateExamDto {
  @IsUUID('4')
  academicYearId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsUUID('4')
  termId?: string | null;

  @IsOptional()
  @IsUUID('4')
  examTypeId?: string | null;

  /** Defaults to the exam type's weight, else 100. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  weight?: number;

  @IsOptional()
  @IsDateOnly()
  startDate?: string | null;

  @IsOptional()
  @IsDateOnly()
  endDate?: string | null;
}

export class UpdateExamDto extends PartialType(
  OmitType(CreateExamDto, ['academicYearId'] as const),
) {}

export class FilterExamDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4')
  academicYearId?: string;

  @IsOptional()
  @IsUUID('4')
  termId?: string;

  @IsOptional()
  @IsEnum(ExamStatus)
  status?: ExamStatus;
}

/** Attach every subject of some classes, or chosen class subjects. */
export class AddExamSubjectsDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  classIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  classSubjectIds?: string[];
}

export class ExamComponentDto {
  @IsIn(Object.values(SubjectComponent))
  component: SubjectComponent;

  @IsInt()
  @Min(1)
  @Max(1000)
  fullMarks: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  passMarks?: number | null;
}

/** This exam's marks scheme for a subject; only while no marks exist. */
export class UpdateExamSubjectDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  passMarks?: number | null;

  /** Replaces the components; full marks become their sum. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ExamComponentDto)
  components?: ExamComponentDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class FilterExamSubjectDto {
  @IsOptional()
  @IsUUID('4')
  classId?: string;
}
