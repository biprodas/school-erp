import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsEmail,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

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
  @IsBoolean() showLogo?: boolean;
  @IsBoolean() showAddress?: boolean;
  @IsBoolean() showContact?: boolean;
  @IsBoolean() showEiin?: boolean;
  @IsOptional() @IsString() @MaxLength(200) tagline?: string | null;
  @IsOptional() @IsString() @MaxLength(300) footerText?: string | null;
}

export class HomePageFactDto {
  @IsDefined() @IsString() @MinLength(1) @MaxLength(20) value!: string;
  @IsDefined() @IsString() @MinLength(1) @MaxLength(60) label!: string;
  @IsOptional() @IsString() @MaxLength(60) labelBn?: string | null;
}

export class HomePageHighlightDto {
  @IsDefined() @IsString() @MinLength(1) @MaxLength(80) title!: string;
  @IsOptional() @IsString() @MaxLength(80) titleBn?: string | null;
  @IsOptional() @IsString() @MaxLength(400) body?: string | null;
  @IsOptional() @IsString() @MaxLength(400) bodyBn?: string | null;
}

export class HomePageAdmissionDto {
  @IsBoolean() open?: boolean;
  @IsOptional() @IsString() @MaxLength(300) note?: string | null;
  @IsOptional() @IsString() @MaxLength(300) noteBn?: string | null;
}

export class HomePageSettingsDto {
  @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() @MaxLength(160) tagline?: string | null;
  @IsOptional() @IsString() @MaxLength(160) taglineBn?: string | null;

  /** A file from `POST /settings/files/home/hero`, or null. */
  @IsOptional() @IsUUID() heroImageFileId?: string | null;

  @IsOptional() @IsString() @MaxLength(2000) about?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) aboutBn?: string | null;
  @IsOptional() @IsString() @MaxLength(3000) principalMessage?: string | null;
  @IsOptional() @IsString() @MaxLength(3000) principalMessageBn?: string | null;

  /** A file from `POST /settings/files/home/principal`, or null. */
  @IsOptional() @IsUUID() principalPhotoFileId?: string | null;

  /** Replaces the list. */
  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => HomePageFactDto)
  facts?: HomePageFactDto[];

  /** Replaces the list. */
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => HomePageHighlightDto)
  highlights?: HomePageHighlightDto[];

  @IsObject()
  @ValidateNested()
  @Type(() => HomePageAdmissionDto)
  admission?: HomePageAdmissionDto;

  @IsBoolean() showContact?: boolean;
  @IsBoolean() showAddress?: boolean;
  @IsBoolean() showNotices?: boolean;
  @IsInt() @Min(1) @Max(50) noticeLimit?: number;
}

/** `PATCH /settings/profile`: any subset; nested objects merge. */
export class UpdateProfileSettingsDto {
  @IsOptional() @IsString() @MaxLength(150) nameBn?: string | null;

  @IsObject()
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

  @IsOptional() @IsString() @MaxLength(100) examControllerName?: string | null;

  /** A file from `POST /settings/files/signature/exam_controller`, or null. */
  @IsOptional() @IsUUID() examControllerSignatureFileId?: string | null;

  @IsObject()
  @ValidateNested()
  @Type(() => ColorSettingsDto)
  colors?: ColorSettingsDto;

  @IsObject()
  @ValidateNested()
  @Type(() => LetterheadSettingsDto)
  letterhead?: LetterheadSettingsDto;

  /** The public home page (PRD 6.24). */
  @IsObject()
  @ValidateNested()
  @Type(() => HomePageSettingsDto)
  homePage?: HomePageSettingsDto;
}
