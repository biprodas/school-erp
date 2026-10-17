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
import { CurrentUser } from '~/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PERMISSIONS } from '../../rbac/permissions.catalog';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { RequirePermissions } from '../../rbac/require-permissions.decorator';
import { CreateStudentDocumentDto } from '../dto/create-student-document.dto';
import { UpdateStudentDocumentDto } from '../dto/update-student-document.dto';
import { StudentDocumentService } from '../services/student-document.service';

@ApiTags('Tenant / Students')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('students/:studentId/documents')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StudentDocumentController {
  constructor(private readonly documentService: StudentDocumentService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.STUDENT_DOCUMENTS_READ)
  async list(@Param('studentId', ParseUUIDPipe) studentId: string) {
    const documents = await this.documentService.listForStudent(studentId);
    return {
      success: true,
      statusCode: 200,
      message: `Documents of student ${studentId}`,
      data: documents,
    };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.STUDENT_DOCUMENTS_CREATE)
  async create(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body() dto: CreateStudentDocumentDto,
    @CurrentUser() user: { userId?: string } | undefined,
  ) {
    const document = await this.documentService.create(
      studentId,
      dto,
      user?.userId ?? null,
    );
    return {
      success: true,
      statusCode: 201,
      message: `Document added to student ${studentId}. ID: ${document.id}`,
      data: document,
    };
  }

  @Patch(':documentId')
  @RequirePermissions(PERMISSIONS.STUDENT_DOCUMENTS_UPDATE)
  async update(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: UpdateStudentDocumentDto,
  ) {
    const document = await this.documentService.update(
      studentId,
      documentId,
      dto,
    );
    return {
      success: true,
      statusCode: 200,
      message: `Document updated. ID: ${document.id}`,
      data: document,
    };
  }

  @Delete(':documentId')
  @RequirePermissions(PERMISSIONS.STUDENT_DOCUMENTS_DELETE)
  async remove(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    await this.documentService.remove(studentId, documentId);
    return {
      success: true,
      statusCode: 200,
      message: `Document removed. ID: ${documentId}`,
    };
  }
}
