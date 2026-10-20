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
  constructor(private readonly medicalService: StudentMedicalRecordService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.STUDENT_MEDICAL_READ)
  @ResponseMessage('Medical record')
  get(@Param('studentId', ParseUUIDPipe) studentId: string) {
    return this.medicalService.getForStudent(studentId);
  }

  // Upsert: the first save creates the record, so either key is enough.
  @Put()
  @RequirePermissions(
    PERMISSIONS.STUDENT_MEDICAL_CREATE,
    PERMISSIONS.STUDENT_MEDICAL_UPDATE,
  )
  @ResponseMessage('Medical record saved')
  upsert(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body() dto: UpsertStudentMedicalRecordDto,
  ) {
    return this.medicalService.upsert(studentId, dto);
  }

  @Delete()
  @RequirePermissions(PERMISSIONS.STUDENT_MEDICAL_DELETE)
  @ResponseMessage('Medical record removed')
  async remove(@Param('studentId', ParseUUIDPipe) studentId: string) {
    await this.medicalService.remove(studentId);
  }
}
