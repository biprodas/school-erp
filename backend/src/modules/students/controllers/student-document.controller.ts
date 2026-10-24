import { Throttle } from '@nestjs/throttler';
import { UPLOAD_THROTTLE } from '~/common/throttling/throttle.constants';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiHeader,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { StudentScope } from '../services/student-scope.service';
import {
  FileUpload,
  requireFile,
} from '~/modules/files/file-upload.interceptor';
import { VerifyStudentDocumentDto } from '../dto/verify-student-document.dto';
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
  constructor(
    private readonly documentService: StudentDocumentService,
    private readonly scope: StudentScope,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.STUDENT_DOCUMENTS_READ)
  @ResponseMessage('Documents')
  async list(@Param('studentId', ParseUUIDPipe) studentId: string) {
    await this.scope.assert(PERMISSIONS.STUDENT_DOCUMENTS_READ, studentId);
    return this.documentService.listForStudent(studentId);
  }

  /** Multipart: `file` plus the fields of the DTO. */
  @Post()
  @RequirePermissions(PERMISSIONS.STUDENT_DOCUMENTS_CREATE)
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(FileUpload('student_document'))
  @ApiConsumes('multipart/form-data')
  @ResponseMessage('Document added')
  async create(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body() dto: CreateStudentDocumentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    await this.scope.assert(PERMISSIONS.STUDENT_DOCUMENTS_CREATE, studentId);
    return this.documentService.create(studentId, dto, requireFile(file));
  }

  @Get(':documentId/download')
  @RequirePermissions(PERMISSIONS.STUDENT_DOCUMENTS_READ)
  @ResponseMessage('Download link')
  async download(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    await this.scope.assert(PERMISSIONS.STUDENT_DOCUMENTS_READ, studentId);
    return this.documentService.downloadUrl(studentId, documentId);
  }

  /** Verified, or rejected with a note. */
  @Post(':documentId/verify')
  @RequirePermissions(PERMISSIONS.STUDENT_DOCUMENTS_UPDATE)
  @ResponseMessage('Document checked')
  async verify(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: VerifyStudentDocumentDto,
  ) {
    await this.scope.assert(PERMISSIONS.STUDENT_DOCUMENTS_UPDATE, studentId);
    return this.documentService.verify(studentId, documentId, dto);
  }

  @Patch(':documentId')
  @RequirePermissions(PERMISSIONS.STUDENT_DOCUMENTS_UPDATE)
  @ResponseMessage('Document updated')
  async update(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: UpdateStudentDocumentDto,
  ) {
    await this.scope.assert(PERMISSIONS.STUDENT_DOCUMENTS_UPDATE, studentId);
    return this.documentService.update(studentId, documentId, dto);
  }

  @Delete(':documentId')
  @RequirePermissions(PERMISSIONS.STUDENT_DOCUMENTS_DELETE)
  @ResponseMessage('Document removed')
  async remove(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    await this.scope.assert(PERMISSIONS.STUDENT_DOCUMENTS_DELETE, studentId);
    await this.documentService.remove(studentId, documentId);
  }
}
