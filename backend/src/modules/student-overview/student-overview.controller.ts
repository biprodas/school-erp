import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { StudentScope } from '~/modules/students/services/student-scope.service';
import { StudentOverviewService } from './student-overview.service';

@ApiTags('Tenant / Students')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('students')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StudentOverviewController {
  constructor(
    private readonly overview: StudentOverviewService,
    private readonly scope: StudentScope,
  ) {}

  /** Student 360: each part appears only with its own permission. */
  @Get(':id/overview')
  @RequirePermissions(PERMISSIONS.STUDENTS_READ)
  @ResponseMessage('Student overview')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    await this.scope.assert(PERMISSIONS.STUDENTS_READ, id);
    return this.overview.overview(id, {
      medical: await this.scope.can(PERMISSIONS.STUDENT_MEDICAL_READ),
      documents: await this.scope.can(PERMISSIONS.STUDENT_DOCUMENTS_READ),
      notes: await this.scope.can(PERMISSIONS.STUDENT_NOTES_READ),
      sensitiveNotes: await this.scope.can(
        PERMISSIONS.STUDENT_NOTES_READ_SENSITIVE,
      ),
      guardians: await this.scope.can(PERMISSIONS.GUARDIANS_READ),
      attendance: await this.scope.can(PERMISSIONS.ATTENDANCE_READ),
    });
  }
}
