import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { ChangeStudentStatusDto } from '~/modules/students/dto/change-student-status.dto';
import { StudentScope } from '~/modules/students/services/student-scope.service';
import { EnrollmentService } from '../services/enrollment.service';

/**
 * The student lifecycle (PRD 6.6). Here rather than in StudentModule
 * because a change also closes or reopens the current enrollment.
 */
@ApiTags('Tenant / Students')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('students')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StudentStatusController {
  constructor(
    private readonly enrollments: EnrollmentService,
    private readonly scope: StudentScope,
  ) {}

  /** Suspend, transfer out, leave, graduate, drop out, or re-admit. */
  @Post(':id/status')
  @RequirePermissions(PERMISSIONS.STUDENTS_UPDATE)
  @ResponseMessage('Student status changed')
  async change(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeStudentStatusDto,
  ) {
    await this.scope.assert(PERMISSIONS.STUDENTS_UPDATE, id);
    return this.enrollments.changeStudentStatus(id, dto);
  }
}
