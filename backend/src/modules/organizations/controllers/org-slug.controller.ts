import { Body, Controller, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { ReqContext } from '~/common/decorators/request-context.decorator';
import { RequestContextDto } from '~/common/dto/request-context.dto';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { IsAdminGuard } from '~/modules/rbac/guards/is-admin.guard';
import { AuditService } from '~/modules/audit/services/audit.service';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';
import { RenameSlugDto } from '../dto/rename-slug.dto';
import { OrganizationService } from '../services/organization.service';

/**
 * Settings → School address (PRD 6.24): school admins change the slug at
 * most once per 30 days; the old one redirects for 12 months.
 */
@ApiTags('Tenant / Settings')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({ name: 'x-tenant-id', required: true })
@Controller('settings/slug')
@UseGuards(JwtAuthGuard, IsAdminGuard)
export class OrgSlugController {
  constructor(
    private readonly organizations: OrganizationService,
    private readonly audit: AuditService,
  ) {}

  @Patch()
  @ResponseMessage('School address changed')
  async rename(
    @ReqContext() ctx: RequestContextDto,
    @Body() dto: RenameSlugDto,
  ) {
    const result = await this.organizations.renameSlug(ctx.orgId!, dto.slug);
    // The change itself committed on the root connection (platform log);
    // this is the school's own record of it.
    await this.audit.record({
      action: AUDIT_ACTIONS.SLUG_CHANGED,
      entityType: 'organization',
      entityId: ctx.orgId!,
      before: { slug: result.previousSlug },
      after: { slug: result.slug },
    });
    return result;
  }
}
