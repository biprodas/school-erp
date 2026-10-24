import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsEnum,
  IsIn,
  IsInt,
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
import {
  AdjustmentType,
  ApprovalStatus,
  LedgerAccount,
  PaymentChannel,
  PaymentStatus,
} from '../enums/fee.enum';
import { MAX_MONEY } from './fee-setup.dto';

export class AllocationDto {
  @IsDefined()
  @IsUUID('4')
  invoiceLineId: string;

  @IsDefined()
  @IsInt()
  @Min(1)
  @Max(MAX_MONEY)
  amount: number;
}

/**
 * Counter collection. Give a student, or a guardian to settle several
 * children at once. Without `allocations` the payment settles the oldest
 * dues first; with them, it must add up to the amount.
 */
export class CreatePaymentDto {
  @IsOptional()
  @IsUUID('4')
  studentId?: string;

  @IsOptional()
  @IsUUID('4')
  guardianId?: string;

  @IsDefined()
  @IsEnum(PaymentChannel)
  channel: PaymentChannel;

  @IsDefined()
  @IsInt()
  @Min(1)
  @Max(MAX_MONEY)
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  reference?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => AllocationDto)
  allocations?: AllocationDto[];
}

export class FilterPaymentDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4')
  studentId?: string;

  @IsOptional()
  @IsUUID('4')
  receivedBy?: string;

  @IsOptional()
  @IsDateOnly()
  from?: string;

  @IsOptional()
  @IsDateOnly()
  to?: string;

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;
}

export class ReceiptPdfDto {
  @IsOptional()
  @IsIn(['80mm', 'A4'])
  paper?: '80mm' | 'A4';
}

export class RequestAdjustmentDto {
  @IsDefined()
  @IsEnum(AdjustmentType)
  type: AdjustmentType;

  @IsDefined()
  @IsUUID('4')
  invoiceLineId: string;

  /** Positive; a correction may be negative (raises what is due). */
  @IsDefined()
  @IsInt()
  @Min(-MAX_MONEY)
  @Max(MAX_MONEY)
  amount: number;

  /** Refunds: cash or bank (default cash). */
  @IsOptional()
  @IsEnum(LedgerAccount)
  paidFrom?: LedgerAccount;

  @IsDefined()
  @IsString()
  @MaxLength(500)
  reason: string;
}

export class FilterAdjustmentDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ApprovalStatus)
  status?: ApprovalStatus;

  @IsOptional()
  @IsUUID('4')
  invoiceId?: string;
}
