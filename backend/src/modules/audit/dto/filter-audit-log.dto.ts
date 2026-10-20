import {
  IsISO8601,
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

  /**
   * Inclusive lower bound, an instant in ISO 8601
   * (`2026-10-01T06:00:00+06:00`). A date alone means midnight UTC, not the
   * school's local midnight. Impossible dates (`2026-02-30`) are rejected.
   */
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  /**
   * Exclusive upper bound, an instant in ISO 8601. A date alone means
   * midnight UTC at the start of that day, so `to=2026-10-02` ends with
   * October 1st (UTC).
   */
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;
}

/** Platform log filters: the school concerned, plus the common ones. */
export class FilterPlatformAuditLogDto extends FilterAuditLogDto {
  @IsOptional()
  @IsUUID()
  orgId?: string;
}
