import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsObject,
  IsOptional,
  Matches,
  ValidateNested,
} from 'class-validator';

export class ChannelPreferencesDto {
  @IsBoolean() inApp?: boolean;
  @IsBoolean() email?: boolean;
  @IsBoolean() sms?: boolean;
}

export class NotificationEventsDto {
  @IsObject()
  @ValidateNested()
  @Type(() => ChannelPreferencesDto)
  absent?: ChannelPreferencesDto;

  @IsObject()
  @ValidateNested()
  @Type(() => ChannelPreferencesDto)
  feeDue?: ChannelPreferencesDto;

  @IsObject()
  @ValidateNested()
  @Type(() => ChannelPreferencesDto)
  paymentReceived?: ChannelPreferencesDto;

  @IsObject()
  @ValidateNested()
  @Type(() => ChannelPreferencesDto)
  resultPublished?: ChannelPreferencesDto;

  @IsObject()
  @ValidateNested()
  @Type(() => ChannelPreferencesDto)
  noticePublished?: ChannelPreferencesDto;
}

export class UpdateNotificationSettingsDto {
  @IsObject()
  @ValidateNested()
  @Type(() => NotificationEventsDto)
  events?: NotificationEventsDto;

  /** Masked sender ID for SMS (Phase 1b): 3–11 letters, digits or spaces. */
  @IsOptional()
  @Matches(/^[A-Za-z0-9 ]{3,11}$/)
  smsSenderId?: string | null;
}
