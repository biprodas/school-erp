import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type { GradingKind } from '../engine/types';

export const GRADING_KINDS: readonly GradingKind[] = [
  'gpa',
  'letter',
  'percentage',
];

export class GradeBandDto {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(24)
  letter: string;

  @IsDefined()
  @IsNumber()
  @Min(0)
  @Max(100)
  minPercent: number;

  @IsDefined()
  @IsNumber()
  @Min(0)
  @Max(100)
  maxPercent: number;

  @IsDefined()
  @IsNumber()
  @Min(0)
  @Max(99)
  point: number;

  @IsOptional()
  @IsBoolean()
  isFail?: boolean;
}

class FourthSubjectDto {
  @IsBoolean()
  enabled: boolean;

  @IsNumber()
  @Min(0)
  @Max(99)
  threshold: number;
}

class GraceDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  perSubject: number;

  @IsNumber()
  @Min(0)
  @Max(1000)
  total: number;
}

class DivisionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  name: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  minPercent: number;
}

/** Any subset; the rest keeps its value (or the template's). */
export class GradingRulesDto {
  @IsOptional()
  @IsIn(['none', 'up', 'nearest'])
  markRounding?: 'none' | 'up' | 'nearest';

  @IsOptional()
  @IsBoolean()
  componentPass?: boolean;

  @IsOptional()
  @IsBoolean()
  failedSubjectFailsResult?: boolean;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => FourthSubjectDto)
  fourthSubject?: FourthSubjectDto;

  @IsOptional()
  @IsNumber()
  @Min(0)
  gpaCap?: number | null;

  @IsOptional()
  @IsIn(['round', 'truncate'])
  gpaRounding?: 'round' | 'truncate';

  /** Null turns grace off. */
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => GraceDto)
  grace?: GraceDto | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => DivisionDto)
  divisions?: DivisionDto[];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(24)
  failGrade?: string;
}

export class CreateGradingSystemDto {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @IsDefined()
  @IsIn(GRADING_KINDS)
  kind: GradingKind;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => GradingRulesDto)
  rules?: GradingRulesDto;

  @IsDefined()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => GradeBandDto)
  items: GradeBandDto[];

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateGradingSystemDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => GradingRulesDto)
  rules?: GradingRulesDto;

  /** Only `true`: making another system the default unsets this one. */
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class ReplaceScaleDto {
  @IsDefined()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => GradeBandDto)
  items: GradeBandDto[];
}

export class CreateFromTemplateDto {
  /** Defaults to the template's name. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class SetClassGradingDto {
  @IsDefined()
  @IsUUID('4')
  academicYearId: string;

  @IsDefined()
  @IsUUID('4')
  classId: string;

  @IsDefined()
  @IsUUID('4')
  gradingSystemId: string;
}

export class FilterClassGradingDto {
  @IsOptional()
  @IsUUID('4')
  academicYearId?: string;
}
