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

export class UpdateLocaleSettingsDto {
  @IsIn(['bn', 'en']) language?: 'bn' | 'en';
  @IsIn(DATE_FORMATS) dateFormat?: DateFormat;
  @IsIn(['bn', 'en']) numerals?: 'bn' | 'en';
  @IsISO4217CurrencyCode() currency?: string;
  @IsTimeZone() timeZone?: string;
  @IsIn(WEEKDAYS) weekStart?: Weekday;

  /** Up to three weekend days; an empty list means a seven-day week. */
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(3)
  @IsIn(WEEKDAYS, { each: true })
  weekendDays?: Weekday[];
}
