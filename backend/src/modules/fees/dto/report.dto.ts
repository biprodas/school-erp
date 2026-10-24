import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
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
} from 'class-validator';
import { IsDateOnly } from '~/common/decorators/is-date-only.decorator';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { LedgerAccount } from '../enums/fee.enum';
import { MAX_MONEY, PERIOD } from './fee-setup.dto';

export class DuesQueryDto {
  @IsOptional()
  @IsUUID('4')
  classId?: string;

  @IsOptional()
  @IsUUID('4')
  sectionId?: string;

  /** Defaults to today. */
  @IsOptional()
  @IsDateOnly()
  asOf?: string;
}

export class DefaultersQueryDto extends DuesQueryDto {
  /** Overdue at least this many days (default 1). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minDays?: number;

  /** At least this much overdue, in minor units. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minAmount?: number;
}

export class PeriodRangeDto {
  @IsDefined()
  @Matches(PERIOD, { message: 'from must be YYYY-MM' })
  from: string;

  @IsDefined()
  @Matches(PERIOD, { message: 'to must be YYYY-MM' })
  to: string;

  @IsOptional()
  @IsUUID('4')
  classId?: string;
}

export class DateRangeDto {
  @IsDefined()
  @IsDateOnly()
  from: string;

  @IsDefined()
  @IsDateOnly()
  to: string;
}

export class DailyCollectionDto {
  /** Defaults to today. */
  @IsOptional()
  @IsDateOnly()
  date?: string;

  /** One collector only. */
  @IsOptional()
  @IsUUID('4')
  receivedBy?: string;
}

export class BookQueryDto extends DateRangeDto {
  @IsDefined()
  @IsEnum(LedgerAccount)
  account: LedgerAccount;
}

export class CreateExpenseCategoryDto {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;
}

export class CreateExpenseDto {
  @IsDefined()
  @IsUUID('4')
  categoryId: string;

  @IsDefined()
  @IsInt()
  @Min(1)
  @Max(MAX_MONEY)
  amount: number;

  @IsDefined()
  @IsEnum(LedgerAccount)
  paidFrom: LedgerAccount;

  /** Defaults to today. */
  @IsOptional()
  @IsDateOnly()
  date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  /** Files uploaded with `POST /expenses/attachments`. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  attachmentFileIds?: string[];
}

export class FilterExpenseDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @IsOptional()
  @IsDateOnly()
  from?: string;

  @IsOptional()
  @IsDateOnly()
  to?: string;
}
