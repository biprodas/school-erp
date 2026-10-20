import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { PlatformJwtAuthGuard } from '~/common/guards/platform-jwt-auth.guard';
import { PlatformAdminGuard } from '~/common/guards/platform-admin.guard';
import { FilterPlatformAuditLogDto } from '../dto/filter-audit-log.dto';
import { PlatformAuditService } from '../services/platform-audit.service';

@ApiTags('Platform / Audit log')
@ApiBearerAuth('platform-jwt')
@Controller('platform/audit-logs')
@UseGuards(PlatformJwtAuthGuard, PlatformAdminGuard)
export class PlatformAuditLogController {
  constructor(private readonly platformAudit: PlatformAuditService) {}

  /** The platform audit log, newest first (super-admins only). */
  @Get()
  @ResponseMessage('Platform audit log')
  findAll(@Query() filter: FilterPlatformAuditLogDto) {
    return this.platformAudit.findFiltered(filter);
  }
}
