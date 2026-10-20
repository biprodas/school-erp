import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  Matches,
  ValidateNested,
} from 'class-validator';
import { OmitOrValidate } from './settings-validators';

export class ChannelPreferencesDto {
  @OmitOrValidate() @IsBoolean() inApp?: boolean;
  @OmitOrValidate() @IsBoolean() email?: boolean;
  @OmitOrValidate() @IsBoolean() sms?: boolean;
}

export class NotificationEventsDto {
  @OmitOrValidate()
  @ValidateNested()
  @Type(() => ChannelPreferencesDto)
  absent?: ChannelPreferencesDto;

  @OmitOrValidate()
  @ValidateNested()
  @Type(() => ChannelPreferencesDto)
  feeDue?: ChannelPreferencesDto;

  @OmitOrValidate()
  @ValidateNested()
  @Type(() => ChannelPreferencesDto)
  paymentReceived?: ChannelPreferencesDto;

  @OmitOrValidate()
  @ValidateNested()
  @Type(() => ChannelPreferencesDto)
  resultPublished?: ChannelPreferencesDto;

  @OmitOrValidate()
  @ValidateNested()
  @Type(() => ChannelPreferencesDto)
  noticePublished?: ChannelPreferencesDto;
}

export class UpdateNotificationSettingsDto {
  @OmitOrValidate()
  @ValidateNested()
  @Type(() => NotificationEventsDto)
  events?: NotificationEventsDto;

  /** Masked sender ID for SMS (Phase 1b): 3–11 letters, digits or spaces. */
  @IsOptional()
  @Matches(/^[A-Za-z0-9 ]{3,11}$/)
  smsSenderId?: string | null;
}
