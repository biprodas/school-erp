import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsISO4217CurrencyCode,
  IsTimeZone,
} from 'class-validator';
import { DATE_FORMATS, WEEKDAYS } from '../settings.types';
import type { DateFormat, Weekday } from '../settings.types';
import { OmitOrValidate } from './settings-validators';

export class UpdateLocaleSettingsDto {
  @OmitOrValidate() @IsIn(['bn', 'en']) language?: 'bn' | 'en';
  @OmitOrValidate() @IsIn(DATE_FORMATS) dateFormat?: DateFormat;
  @OmitOrValidate() @IsIn(['bn', 'en']) numerals?: 'bn' | 'en';
  @OmitOrValidate() @IsISO4217CurrencyCode() currency?: string;
  @OmitOrValidate() @IsTimeZone() timeZone?: string;
  @OmitOrValidate() @IsIn(WEEKDAYS) weekStart?: Weekday;

  /** Up to three weekend days; an empty list means a seven-day week. */
  @OmitOrValidate()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(3)
  @IsIn(WEEKDAYS, { each: true })
  weekendDays?: Weekday[];
}
