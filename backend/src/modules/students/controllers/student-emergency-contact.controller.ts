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
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PERMISSIONS } from '../../rbac/permissions.catalog';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { RequirePermissions } from '../../rbac/require-permissions.decorator';
import { CreateStudentEmergencyContactDto } from '../dto/create-student-emergency-contact.dto';
import { UpdateStudentEmergencyContactDto } from '../dto/update-student-emergency-contact.dto';
import { StudentEmergencyContactService } from '../services/student-emergency-contact.service';

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
  async list(@Param('studentId', ParseUUIDPipe) studentId: string) {
    const contacts = await this.contactService.listForStudent(studentId);
    return {
      success: true,
      statusCode: 200,
      message: `Emergency contacts of student ${studentId}`,
      data: contacts,
    };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.STUDENTS_CREATE)
  async create(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body() dto: CreateStudentEmergencyContactDto,
  ) {
    const contact = await this.contactService.create(studentId, dto);
    return {
      success: true,
      statusCode: 201,
      message: `Emergency contact added to student ${studentId}. ID: ${contact.id}`,
      data: contact,
    };
  }

  @Patch(':contactId')
  @RequirePermissions(PERMISSIONS.STUDENTS_UPDATE)
  async update(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Body() dto: UpdateStudentEmergencyContactDto,
  ) {
    const contact = await this.contactService.update(studentId, contactId, dto);
    return {
      success: true,
      statusCode: 200,
      message: `Emergency contact updated. ID: ${contact.id}`,
      data: contact,
    };
  }

  @Delete(':contactId')
  @RequirePermissions(PERMISSIONS.STUDENTS_DELETE)
  async remove(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ) {
    await this.contactService.remove(studentId, contactId);
    return {
      success: true,
      statusCode: 200,
      message: `Emergency contact removed. ID: ${contactId}`,
    };
  }
}
