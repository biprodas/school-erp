import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsDefined,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { AUDIENCE_TYPES, type AudienceType } from '../audience';

export class AudienceDto {
  @IsDefined()
  @IsIn(AUDIENCE_TYPES)
  type: AudienceType;

  /** Required for role, class, section, group and users. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  ids?: string[];
}

export class CreateNoticeDto {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20_000)
  body: string;

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => AudienceDto)
  audience: AudienceDto;

  /** Defaults to now; a later time schedules it. */
  @IsOptional()
  @IsDateString()
  publishAt?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  /** Files from `POST /notices/attachments`. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  attachmentFileIds?: string[];
}

export class UpdateNoticeDto extends PartialType(CreateNoticeDto) {}

export class FilterNoticeDto extends PaginationQueryDto {
  /** Include ones not published yet and expired ones (managers). */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  all?: boolean;
}
