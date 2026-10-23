import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

/** `HH:mm` or `HH:mm:ss`, 24-hour. */
export const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export class CreateShiftDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name: string;

  @Matches(TIME_OF_DAY, { message: 'startTime must be HH:mm' })
  startTime: string;

  @Matches(TIME_OF_DAY, { message: 'endTime must be HH:mm' })
  endTime: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
