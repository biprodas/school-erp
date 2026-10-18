import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { AttachGuardianDto } from '../dto/attach-guardian.dto';
import { UpdateLinkDto } from '../dto/update-link.dto';
import { GuardianService } from '../services/guardian.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

@ApiTags('Tenant / Guardians')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('students/:studentId/guardians')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StudentGuardianController {
  constructor(private readonly guardianService: GuardianService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.GUARDIANS_READ)
  @ResponseMessage('Guardians')
  list(@Param('studentId', ParseUUIDPipe) studentId: string) {
    return this.guardianService.listForStudent(studentId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.GUARDIANS_CREATE)
  @ResponseMessage('Guardian linked')
  attach(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body() dto: AttachGuardianDto,
  ) {
    return this.guardianService.attach(studentId, dto);
  }

  @Patch(':linkId')
  @RequirePermissions(PERMISSIONS.GUARDIANS_UPDATE)
  @ResponseMessage('Guardian link updated')
  updateLink(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
    @Body() dto: UpdateLinkDto,
  ) {
    return this.guardianService.updateLink(studentId, linkId, dto);
  }

  @Delete(':linkId')
  @RequirePermissions(PERMISSIONS.GUARDIANS_DELETE)
  @ResponseMessage('Guardian link removed')
  async detach(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
  ) {
    await this.guardianService.detach(studentId, linkId);
  }
}
