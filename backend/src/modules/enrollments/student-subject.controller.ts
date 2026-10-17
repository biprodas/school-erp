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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PERMISSIONS } from '../rbac/permissions.catalog';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { SelectSubjectDto } from './dto/select-subject.dto';
import { EnrollmentService } from './enrollment.service';

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
  async list(@Param('enrollmentId', ParseUUIDPipe) enrollmentId: string) {
    const links = await this.enrollmentService.listSubjects(enrollmentId);
    return {
      success: true,
      statusCode: 200,
      message: `Subjects selected for enrollment ${enrollmentId}`,
      data: links,
    };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.STUDENT_SUBJECTS_CREATE)
  async select(
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
    @Body() dto: SelectSubjectDto,
  ) {
    const link = await this.enrollmentService.selectSubject(enrollmentId, dto);
    return {
      success: true,
      statusCode: 201,
      message: `Subject selected for enrollment ${enrollmentId}. Link ID: ${link.id}`,
      data: link,
    };
  }

  @Delete(':linkId')
  @RequirePermissions(PERMISSIONS.STUDENT_SUBJECTS_DELETE)
  async deselect(
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
  ) {
    await this.enrollmentService.deselectSubject(enrollmentId, linkId);
    return {
      success: true,
      statusCode: 200,
      message: `Subject selection removed. Link ID: ${linkId}`,
    };
  }
}
