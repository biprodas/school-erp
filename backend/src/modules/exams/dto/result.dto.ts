import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDefined,
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
import { ResultSheetType } from '../enums/exam.enum';

export class ResultItemDto {
  @IsDefined()
  @IsUUID('4')
  examId: string;

  @IsDefined()
  @IsNumber()
  @Min(0.01)
  @Max(100)
  weight: number;
}

/** A combined result, e.g. 30% half-yearly + 70% annual. */
export class CreateResultDefinitionDto {
  @IsDefined()
  @IsUUID('4')
  academicYearId: string;

  @IsDefined()
  @IsUUID('4')
  classId: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsDefined()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ResultItemDto)
  items: ResultItemDto[];
}

export class FilterResultDefinitionDto {
  @IsOptional()
  @IsUUID('4')
  academicYearId?: string;

  @IsOptional()
  @IsUUID('4')
  classId?: string;

  @IsOptional()
  @IsUUID('4')
  examId?: string;
}

export class ResultsQueryDto {
  @IsOptional()
  @IsUUID('4')
  sectionId?: string;
}

export class MeritQueryDto extends ResultsQueryDto {
  /** Only the first N positions. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}

export class RemarksDto {
  @IsDefined()
  @IsString()
  @MaxLength(1000)
  remarks: string;
}

export class ReportCardsDto {
  @IsDefined()
  @IsUUID('4')
  sectionId: string;

  /** Defaults to `results.reportCard.language`. */
  @IsOptional()
  @IsIn(['en', 'bn'])
  language?: 'en' | 'bn';
}

export class ResultExportDto {
  @IsDefined()
  @IsEnum(ResultSheetType)
  type: ResultSheetType;

  @IsDefined()
  @IsIn(['xlsx', 'pdf'])
  format: 'xlsx' | 'pdf';

  @IsOptional()
  @IsUUID('4')
  sectionId?: string;
}
