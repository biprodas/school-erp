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
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { CreateStudentDocumentDto } from '../dto/create-student-document.dto';
import { UpdateStudentDocumentDto } from '../dto/update-student-document.dto';
import { StudentDocumentService } from '../services/student-document.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

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
  @ResponseMessage('Documents')
  list(@Param('studentId', ParseUUIDPipe) studentId: string) {
    return this.documentService.listForStudent(studentId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.STUDENT_DOCUMENTS_CREATE)
  @ResponseMessage('Document added')
  create(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body() dto: CreateStudentDocumentDto,
    @CurrentUser() user: { userId?: string } | undefined,
  ) {
    return this.documentService.create(studentId, dto, user?.userId ?? null);
  }

  @Patch(':documentId')
  @RequirePermissions(PERMISSIONS.STUDENT_DOCUMENTS_UPDATE)
  @ResponseMessage('Document updated')
  update(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: UpdateStudentDocumentDto,
  ) {
    return this.documentService.update(studentId, documentId, dto);
  }

  @Delete(':documentId')
  @RequirePermissions(PERMISSIONS.STUDENT_DOCUMENTS_DELETE)
  @ResponseMessage('Document removed')
  async remove(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    await this.documentService.remove(studentId, documentId);
  }
}
