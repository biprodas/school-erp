import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { SelectSubjectDto } from '../dto/select-subject.dto';
import { EnrollmentService } from '../services/enrollment.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

@ApiTags('Tenant / Enrollments')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('enrollments/:enrollmentId/subjects')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StudentSubjectController {
  constructor(private readonly enrollmentService: EnrollmentService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.STUDENT_SUBJECTS_READ)
  @ResponseMessage('Subjects selected')
  list(@Param('enrollmentId', ParseUUIDPipe) enrollmentId: string) {
    return this.enrollmentService.listSubjects(enrollmentId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.STUDENT_SUBJECTS_CREATE)
  @ResponseMessage('Subject selected')
  select(
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
    @Body() dto: SelectSubjectDto,
  ) {
    return this.enrollmentService.selectSubject(enrollmentId, dto);
  }

  @Delete(':linkId')
  @RequirePermissions(PERMISSIONS.STUDENT_SUBJECTS_DELETE)
  @ResponseMessage('Subject selection removed')
  async deselect(
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
  ) {
    await this.enrollmentService.deselectSubject(enrollmentId, linkId);
  }
}
