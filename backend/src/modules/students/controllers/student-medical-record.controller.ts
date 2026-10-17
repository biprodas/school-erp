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
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PERMISSIONS } from '../../rbac/permissions.catalog';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { RequirePermissions } from '../../rbac/require-permissions.decorator';
import { UpsertStudentMedicalRecordDto } from '../dto/upsert-student-medical-record.dto';
import { StudentMedicalRecordService } from '../services/student-medical-record.service';

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
  async get(@Param('studentId', ParseUUIDPipe) studentId: string) {
    const record = await this.medicalService.getForStudent(studentId);
    return {
      success: true,
      statusCode: 200,
      message: `Medical record of student ${studentId}`,
      data: record,
    };
  }

  @Put()
  @RequirePermissions(PERMISSIONS.STUDENT_MEDICAL_UPDATE)
  async upsert(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body() dto: UpsertStudentMedicalRecordDto,
  ) {
    const record = await this.medicalService.upsert(studentId, dto);
    return {
      success: true,
      statusCode: 200,
      message: `Medical record saved for student ${studentId}`,
      data: record,
    };
  }

  @Delete()
  @RequirePermissions(PERMISSIONS.STUDENT_MEDICAL_DELETE)
  async remove(@Param('studentId', ParseUUIDPipe) studentId: string) {
    await this.medicalService.remove(studentId);
    return {
      success: true,
      statusCode: 200,
      message: `Medical record removed for student ${studentId}`,
    };
  }
}
