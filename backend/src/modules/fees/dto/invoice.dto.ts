import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
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
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { InvoiceStatus } from '../enums/fee.enum';
import { MAX_MONEY, PERIOD } from './fee-setup.dto';

export class GenerateInvoicesDto {
  /** `YYYY-MM`; defaults to this month. */
  @IsOptional()
  @Matches(PERIOD, { message: 'period must be YYYY-MM' })
  period?: string;

  /** Only these classes; omit for all. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  classIds?: string[];
}

export class AdhocLineDto {
  @IsOptional()
  @IsUUID('4')
  feeHeadId?: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  description: string;

  @IsDefined()
  @IsInt()
  @Min(1)
  @Max(MAX_MONEY)
  amount: number;
}

/** A hand-made invoice (fines, events, a missed admission fee). */
export class CreateInvoiceDto {
  @IsDefined()
  @IsUUID('4')
  studentId: string;

  /** Defaults to today in the school's zone. */
  @IsOptional()
  @IsDateOnly()
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsDefined()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => AdhocLineDto)
  lines: AdhocLineDto[];
}

export class CancelDto {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}

export class FilterInvoiceDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4')
  studentId?: string;

  @IsOptional()
  @IsUUID('4')
  classId?: string;

  @IsOptional()
  @IsUUID('4')
  sectionId?: string;

  @IsOptional()
  @Matches(PERIOD, { message: 'period must be YYYY-MM' })
  period?: string;

  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;
}
