import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';

export class FilterAuditLogDto extends PaginationQueryDto {
  /** An action (`auth.account_locked`), or a prefix ending in `.` (`auth.`). */
  @IsOptional()
  @Matches(/^[a-z_]+\.([a-z_]+)?$/)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityId?: string;

  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  /** Inclusive lower bound (ISO 8601). */
  @IsOptional()
  @IsDateString()
  from?: string;

  /** Exclusive upper bound (ISO 8601). */
  @IsOptional()
  @IsDateString()
  to?: string;
}

/** Platform log filters: the school concerned, plus the common ones. */
export class FilterPlatformAuditLogDto extends FilterAuditLogDto {
  @IsOptional()
  @IsUUID()
  orgId?: string;
}
