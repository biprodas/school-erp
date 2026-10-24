import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { IsDateOnly } from '~/common/decorators/is-date-only.decorator';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { NOTIFICATION_EVENTS } from '~/modules/settings/settings.types';

export class FilterNotificationDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  unreadOnly?: boolean;
}

export class SaveTemplateDto {
  @IsDefined()
  @IsIn(NOTIFICATION_EVENTS)
  key: string;

  @IsDefined()
  @IsIn(['inApp', 'email'])
  channel: 'inApp' | 'email';

  @IsDefined()
  @IsIn(['en', 'bn'])
  locale: 'en' | 'bn';

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  body: string;
}

export class FilterDeliveryLogDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['in_app', 'email'])
  channel?: string;

  @IsOptional()
  @IsIn(['queued', 'sent', 'failed'])
  status?: string;

  @IsOptional()
  @IsIn(NOTIFICATION_EVENTS)
  templateKey?: string;

  @IsOptional()
  @IsDateOnly()
  from?: string;

  @IsOptional()
  @IsDateOnly()
  to?: string;
}
