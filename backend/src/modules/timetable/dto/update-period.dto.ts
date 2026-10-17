import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export class UpdatePeriodDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @Matches(TIME_REGEX, { message: 'startTime must be HH:mm or HH:mm:ss' })
  startTime?: string;

  @IsOptional()
  @Matches(TIME_REGEX, { message: 'endTime must be HH:mm or HH:mm:ss' })
  endTime?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
