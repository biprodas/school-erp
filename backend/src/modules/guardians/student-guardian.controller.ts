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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PERMISSIONS } from '../rbac/permissions.catalog';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { AttachGuardianDto } from './dto/attach-guardian.dto';
import { UpdateLinkDto } from './dto/update-link.dto';
import { GuardianService } from './guardian.service';

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
  async list(@Param('studentId', ParseUUIDPipe) studentId: string) {
    const links = await this.guardianService.listForStudent(studentId);
    return {
      success: true,
      statusCode: 200,
      message: `Guardians of student ${studentId}`,
      data: links,
    };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.GUARDIANS_CREATE)
  async attach(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body() dto: AttachGuardianDto,
  ) {
    const link = await this.guardianService.attach(studentId, dto);
    return {
      success: true,
      statusCode: 201,
      message: `Guardian linked to student ${studentId}. Link ID: ${link.id}`,
      data: link,
    };
  }

  @Patch(':linkId')
  @RequirePermissions(PERMISSIONS.GUARDIANS_UPDATE)
  async updateLink(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
    @Body() dto: UpdateLinkDto,
  ) {
    const link = await this.guardianService.updateLink(studentId, linkId, dto);
    return {
      success: true,
      statusCode: 200,
      message: `Guardian link updated. Link ID: ${link.id}`,
      data: link,
    };
  }

  @Delete(':linkId')
  @RequirePermissions(PERMISSIONS.GUARDIANS_DELETE)
  async detach(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
  ) {
    await this.guardianService.detach(studentId, linkId);
    return {
      success: true,
      statusCode: 200,
      message: `Guardian link removed. Link ID: ${linkId}`,
    };
  }
}
