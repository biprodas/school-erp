import { PartialType, OmitType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDefined,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CountsAs } from '../enums/attendance.enum';

export class CreateAttendanceStatusDto {
  @IsDefined()
  /** Lowercase letters, digits and `_`; fixed once created. */
  @Matches(/^[a-z][a-z0-9_]{1,15}$/, {
    message: 'code must be 2–16 lowercase letters, digits or _',
  })
  code: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  labelEn: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  labelBn: string;

  @IsDefined()
  @IsEnum(CountsAs)
  countsAs: CountsAs;

  /** Shown in the register grid. */
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(3)
  symbol: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateAttendanceStatusDto extends PartialType(
  OmitType(CreateAttendanceStatusDto, ['code'] as const),
) {}
