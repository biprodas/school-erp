import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsDateOnly } from '~/common/decorators/is-date-only.decorator';
import {
  ApprovalStatus,
  DiscountCode,
  DiscountKind,
  FeeFrequency,
  FineKind,
} from '../enums/fee.enum';

export const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;
/** Up to 1 000 000 000.00 in minor units. */
export const MAX_MONEY = 100_000_000_000;

export class CreateFeeHeadDto {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  nameBn?: string | null;

  @IsDefined()
  @IsEnum(FeeFrequency)
  frequency: FeeFrequency;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateFeeHeadDto extends PartialType(CreateFeeHeadDto) {}

export class FeeStructureItemDto {
  @IsDefined()
  @IsUUID('4')
  feeHeadId: string;

  /** Minor units (poisha). */
  @IsDefined()
  @IsInt()
  @Min(0)
  @Max(MAX_MONEY)
  amount: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  dueDay?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(12, { each: true })
  months?: number[] | null;
}

export class CreateFeeStructureDto {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsDefined()
  @IsUUID('4')
  academicYearId: string;

  @IsDefined()
  @IsUUID('4')
  classId: string;

  @IsOptional()
  @IsUUID('4')
  subjectGroupId?: string | null;

  @IsOptional()
  @IsUUID('4')
  shiftId?: string | null;

  /** Defaults to the session's first day. */
  @IsOptional()
  @IsDateOnly()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateOnly()
  effectiveTo?: string | null;

  @IsDefined()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => FeeStructureItemDto)
  items: FeeStructureItemDto[];
}

/** Items, when given, replace the structure's items. */
export class UpdateFeeStructureDto extends PartialType(CreateFeeStructureDto) {}

export class FilterFeeStructureDto {
  @IsOptional()
  @IsUUID('4')
  academicYearId?: string;

  @IsOptional()
  @IsUUID('4')
  classId?: string;
}

export class CreateDiscountTypeDto {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsEnum(DiscountCode)
  code?: DiscountCode;

  @IsDefined()
  @IsEnum(DiscountKind)
  kind: DiscountKind;

  /** Basis points for percent (1000 = 10%), minor units for fixed. */
  @IsDefined()
  @IsInt()
  @Min(1)
  @Max(MAX_MONEY)
  value: number;

  /** Empty = every head. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  appliesToHeadIds?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateDiscountTypeDto extends PartialType(CreateDiscountTypeDto) {}

export class RequestStudentDiscountDto {
  @IsDefined()
  @IsUUID('4')
  studentId: string;

  @IsDefined()
  @IsUUID('4')
  discountTypeId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_MONEY)
  valueOverride?: number | null;

  @IsDefined()
  @Matches(PERIOD, { message: 'fromPeriod must be YYYY-MM' })
  fromPeriod: string;

  @IsOptional()
  @Matches(PERIOD, { message: 'toPeriod must be YYYY-MM' })
  toPeriod?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class FilterStudentDiscountDto {
  @IsOptional()
  @IsUUID('4')
  studentId?: string;

  @IsOptional()
  @IsEnum(ApprovalStatus)
  status?: ApprovalStatus;
}

export class DecisionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CreateLateFineRuleDto {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsUUID('4')
  feeHeadId?: string | null;

  @IsDefined()
  @IsEnum(FineKind)
  kind: FineKind;

  @IsDefined()
  @IsInt()
  @Min(1)
  @Max(MAX_MONEY)
  amount: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  graceDays?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_MONEY)
  maxAmount?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateLateFineRuleDto extends PartialType(CreateLateFineRuleDto) {}
