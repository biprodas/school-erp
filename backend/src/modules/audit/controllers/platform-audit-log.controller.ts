import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { PlatformJwtAuthGuard } from '~/common/guards/platform-jwt-auth.guard';
import { PlatformPermissionsGuard } from '~/common/guards/platform-permissions.guard';
import { RequirePlatformPermissions } from '~/common/decorators/require-platform-permissions.decorator';
import { PLATFORM_PERMISSIONS } from '~/common/auth/platform-permissions';
import { FilterPlatformAuditLogDto } from '../dto/filter-audit-log.dto';
import { PlatformAuditService } from '../services/platform-audit.service';

@ApiTags('Platform / Audit log')
@ApiBearerAuth('platform-jwt')
@Controller('platform/audit-logs')
@UseGuards(PlatformJwtAuthGuard, PlatformPermissionsGuard)
@RequirePlatformPermissions(PLATFORM_PERMISSIONS.AUDIT_READ)
export class PlatformAuditLogController {
  constructor(private readonly platformAudit: PlatformAuditService) {}

  /** The platform audit log, newest first (`audit:read`). */
  @Get()
  @ResponseMessage('Platform audit log')
  findAll(@Query() filter: FilterPlatformAuditLogDto) {
    return this.platformAudit.findFiltered(filter);
  }
}
