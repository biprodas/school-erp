import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { FilterAuditLogDto } from '../dto/filter-audit-log.dto';
import { AuditService } from '../services/audit.service';

@ApiTags('Tenant / Audit log')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditLogController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * The school's audit log, newest first. E.g. `?action=auth.account_locked`
   * for lockouts, `?action=role.` for every role change.
   */
  @Get()
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  @ResponseMessage('Audit log')
  findAll(@Query() filter: FilterAuditLogDto) {
    return this.auditService.findFiltered(filter);
  }
}
