import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { StudentScope } from '../services/student-scope.service';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { UpsertStudentMedicalRecordDto } from '../dto/upsert-student-medical-record.dto';
import { StudentMedicalRecordService } from '../services/student-medical-record.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

@ApiTags('Tenant / Students')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('students/:studentId/medical-record')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StudentMedicalRecordController {
  constructor(
    private readonly medicalService: StudentMedicalRecordService,
    private readonly scope: StudentScope,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.STUDENT_MEDICAL_READ)
  @ResponseMessage('Medical record')
  async get(@Param('studentId', ParseUUIDPipe) studentId: string) {
    await this.scope.assert(PERMISSIONS.STUDENT_MEDICAL_READ, studentId);
    return this.medicalService.getForStudent(studentId);
  }

  // Upsert: the first save creates the record, so either key is enough.
  @Put()
  @RequirePermissions(
    PERMISSIONS.STUDENT_MEDICAL_CREATE,
    PERMISSIONS.STUDENT_MEDICAL_UPDATE,
  )
  @ResponseMessage('Medical record saved')
  async upsert(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body() dto: UpsertStudentMedicalRecordDto,
  ) {
    await this.scope.assertAny(
      [PERMISSIONS.STUDENT_MEDICAL_CREATE, PERMISSIONS.STUDENT_MEDICAL_UPDATE],
      studentId,
    );
    return this.medicalService.upsert(studentId, dto);
  }

  @Delete()
  @RequirePermissions(PERMISSIONS.STUDENT_MEDICAL_DELETE)
  @ResponseMessage('Medical record removed')
  async remove(@Param('studentId', ParseUUIDPipe) studentId: string) {
    await this.scope.assert(PERMISSIONS.STUDENT_MEDICAL_DELETE, studentId);
    await this.medicalService.remove(studentId);
  }
}
