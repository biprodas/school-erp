import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsDefined,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import {
  ADD_ON_MODULES,
  PlanCode,
  type PlanModule,
} from '~/modules/plans/plans.catalog';
import { OrganizationStatus } from '../enums/organization-status.enum';
import { OrganizationType } from '../enums/organization-type.enum';

/** `GET /organizations` filters (school directory, super-admin). */
export class FilterOrganizationDto extends PaginationQueryDto {
  /** Name or slug contains. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsEnum(PlanCode)
  plan?: PlanCode;

  @IsOptional()
  @IsEnum(OrganizationStatus)
  status?: OrganizationStatus;

  @IsOptional()
  @IsEnum(OrganizationType)
  type?: OrganizationType;

  /** District from the school's profile settings (case-insensitive). */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  district?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  createdFrom?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  createdTo?: string;
}

export class ChangePlanDto {
  @IsDefined()
  @IsEnum(PlanCode)
  planCode: PlanCode;

  /** Replaces the school's add-on modules when given. */
  @ApiPropertyOptional({ enum: ADD_ON_MODULES, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(ADD_ON_MODULES, { each: true })
  addOnModules?: PlanModule[];
}

export class ExtendTrialDto {
  @IsDefined()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  days: number;
}

/**
 * Per-school limits, replacing the previous overrides: an omitted key
 * follows the plan, `null` means unlimited, a number is the limit.
 */
export class SetLimitsDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  students?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  storageMb?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  users?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  admins?: number | null;
}
