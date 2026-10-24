import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { AccessScope } from '~/modules/access-scope/access-scope.service';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import {
  PERMISSIONS,
  type PermissionKey,
} from '~/modules/rbac/permissions.catalog';
import { CredentialSlipService } from './credential-slip.service';
import {
  PrintCredentialSlipsDto,
  SlipAudience,
} from './dto/credential-slips.dto';

@ApiTags('Tenant / Users')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CredentialSlipController {
  constructor(
    private readonly slips: CredentialSlipService,
    private readonly scope: AccessScope,
  ) {}

  /**
   * Printed sign-in slips for a section's guardians and/or students (job;
   * the PDF link is on `GET /jobs/:id`). Needs `guardians:update` for
   * guardian slips and `students:update` for student slips, for that
   * section.
   */
  @Post('sections/:sectionId/credential-slips')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions(PERMISSIONS.GUARDIANS_UPDATE, PERMISSIONS.STUDENTS_UPDATE)
  @ResponseMessage('Sign-in slips started')
  async print(
    @Param('sectionId', ParseUUIDPipe) sectionId: string,
    @Body() dto: PrintCredentialSlipsDto,
  ) {
    const audience = dto.audience ?? SlipAudience.GUARDIANS;
    const keys: PermissionKey[] = [];
    if (audience !== SlipAudience.STUDENTS)
      keys.push(PERMISSIONS.GUARDIANS_UPDATE);
    if (audience !== SlipAudience.GUARDIANS)
      keys.push(PERMISSIONS.STUDENTS_UPDATE);
    for (const key of keys) {
      if (!(await this.scope.canAccessSection(key, sectionId))) {
        throw new NotFoundException('Section not found');
      }
    }
    return this.slips.start(sectionId, {
      audience,
      includeEmailAccounts: dto.includeEmailAccounts ?? false,
    });
  }
}
