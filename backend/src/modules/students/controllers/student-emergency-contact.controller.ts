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
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { CreateStudentEmergencyContactDto } from '../dto/create-student-emergency-contact.dto';
import { UpdateStudentEmergencyContactDto } from '../dto/update-student-emergency-contact.dto';
import { StudentEmergencyContactService } from '../services/student-emergency-contact.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

@ApiTags('Tenant / Students')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('students/:studentId/emergency-contacts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StudentEmergencyContactController {
  constructor(
    private readonly contactService: StudentEmergencyContactService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.STUDENTS_READ)
  @ResponseMessage('Emergency contacts')
  list(@Param('studentId', ParseUUIDPipe) studentId: string) {
    return this.contactService.listForStudent(studentId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.STUDENTS_CREATE)
  @ResponseMessage('Emergency contact added')
  create(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body() dto: CreateStudentEmergencyContactDto,
  ) {
    return this.contactService.create(studentId, dto);
  }

  @Patch(':contactId')
  @RequirePermissions(PERMISSIONS.STUDENTS_UPDATE)
  @ResponseMessage('Emergency contact updated')
  update(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Body() dto: UpdateStudentEmergencyContactDto,
  ) {
    return this.contactService.update(studentId, contactId, dto);
  }

  @Delete(':contactId')
  @RequirePermissions(PERMISSIONS.STUDENTS_DELETE)
  @ResponseMessage('Emergency contact removed')
  async remove(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ) {
    await this.contactService.remove(studentId, contactId);
  }
}
