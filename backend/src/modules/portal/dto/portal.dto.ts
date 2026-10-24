import {
  IsDefined,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { IsDateOnly } from '~/common/decorators/is-date-only.decorator';

export class PortalHandoffDto {
  @IsDefined()
  @IsUUID('4')
  orgId: string;
}

export class PortalAttendanceQueryDto {
  /** `YYYY-MM`; defaults to this month. */
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month must be YYYY-MM' })
  month?: string;
}

export class PortalLeaveDto {
  @IsDefined()
  @IsDateOnly()
  fromDate: string;

  @IsOptional()
  @IsDateOnly()
  toDate?: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}

export class PortalReceiptPdfDto {
  @IsOptional()
  @IsIn(['80mm', 'A4'])
  paper?: '80mm' | 'A4';
}
