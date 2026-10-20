import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { OmitOrValidate } from './settings-validators';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export class AddressSettingsDto {
  @IsOptional() @IsString() @MaxLength(200) line1?: string | null;
  @IsOptional() @IsString() @MaxLength(200) line2?: string | null;
  @IsOptional() @IsString() @MaxLength(100) area?: string | null;
  @IsOptional() @IsString() @MaxLength(100) district?: string | null;
  @IsOptional() @IsString() @MaxLength(12) postCode?: string | null;
}

export class ColorSettingsDto {
  @IsOptional() @Matches(HEX_COLOR) primary?: string | null;
  @IsOptional() @Matches(HEX_COLOR) secondary?: string | null;
}

export class LetterheadSettingsDto {
  @OmitOrValidate() @IsBoolean() showLogo?: boolean;
  @OmitOrValidate() @IsBoolean() showAddress?: boolean;
  @OmitOrValidate() @IsBoolean() showContact?: boolean;
  @OmitOrValidate() @IsBoolean() showEiin?: boolean;
  @IsOptional() @IsString() @MaxLength(200) tagline?: string | null;
  @IsOptional() @IsString() @MaxLength(300) footerText?: string | null;
}

/** `PATCH /settings/profile`: any subset; nested objects merge. */
export class UpdateProfileSettingsDto {
  @IsOptional() @IsString() @MaxLength(150) nameBn?: string | null;

  @OmitOrValidate()
  @ValidateNested()
  @Type(() => AddressSettingsDto)
  address?: AddressSettingsDto;

  @IsOptional() @IsString() @MaxLength(32) phone?: string | null;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string | null;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(255)
  website?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1800)
  @Max(2100)
  establishedYear?: number | null;

  @IsOptional() @IsString() @MaxLength(100) principalName?: string | null;

  /** A file uploaded through `POST /settings/files/signature`, or null. */
  @IsOptional() @IsUUID() principalSignatureFileId?: string | null;

  @OmitOrValidate()
  @ValidateNested()
  @Type(() => ColorSettingsDto)
  colors?: ColorSettingsDto;

  @OmitOrValidate()
  @ValidateNested()
  @Type(() => LetterheadSettingsDto)
  letterhead?: LetterheadSettingsDto;
}
