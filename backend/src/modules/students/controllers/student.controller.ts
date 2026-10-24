import { Throttle } from '@nestjs/throttler';
import { UPLOAD_THROTTLE } from '~/common/throttling/throttle.constants';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import {
  FileUpload,
  requireFile,
  UPLOAD_BODY,
} from '~/modules/files/file-upload.interceptor';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { CreateStudentDto } from '../dto/create-student.dto';
import { ExportStudentsDto } from '../dto/export-students.dto';
import { FilterStudentDto } from '../dto/filter-student.dto';
import { UpdateStudentDto } from '../dto/update-student.dto';
import { StudentService } from '../services/student.service';
import { StudentExportService } from '../services/student-export.service';
import { StudentScope } from '../services/student-scope.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

/**
 * Students (PRD 6.6). Reads follow the scope rules: a teacher with
 * assigned scope sees the students of the sections they teach. Status
 * changes are `POST /students/:id/status` (EnrollmentModule, since they
 * close the enrollment too).
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
export class StudentController {
  constructor(
    private readonly studentService: StudentService,
    private readonly scope: StudentScope,
    private readonly exports: StudentExportService,
  ) {}

  /** Search by name, ID or phone; filter by class, section, status, … */
  @Get()
  @RequirePermissions(PERMISSIONS.STUDENTS_READ)
  @ResponseMessage('List of students')
  async findAll(@Query() filter: FilterStudentDto) {
    const allowed = await this.scope.sections(PERMISSIONS.STUDENTS_READ);
    return this.studentService.findFiltered(filter, allowed);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.STUDENTS_CREATE)
  @ResponseMessage('Student created')
  create(@Body() dto: CreateStudentDto) {
    return this.studentService.create(dto);
  }

  /** The filtered list as Excel or PDF; poll `GET /jobs/:id`. */
  @Post('export')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions(PERMISSIONS.STUDENTS_EXPORT)
  @ResponseMessage('Export started')
  export(@Body() dto: ExportStudentsDto) {
    return this.exports.start(dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.STUDENTS_READ)
  @ResponseMessage('Student found')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    await this.scope.assert(PERMISSIONS.STUDENTS_READ, id);
    const student = await this.studentService.findById(id);
    return Object.assign(student, {
      photoUrl: await this.studentService.photoUrl(student),
    });
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.STUDENTS_UPDATE)
  @ResponseMessage('Student updated')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudentDto,
  ) {
    await this.scope.assert(PERMISSIONS.STUDENTS_UPDATE, id);
    return this.studentService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.STUDENTS_DELETE)
  @ResponseMessage('Student deleted')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.studentService.remove(id);
  }

  @Post(':id/photo')
  @RequirePermissions(PERMISSIONS.STUDENTS_UPDATE)
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(FileUpload('student_photo'))
  @ApiConsumes('multipart/form-data')
  @ApiBody(UPLOAD_BODY)
  @ResponseMessage('Photo updated')
  async uploadPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    await this.scope.assert(PERMISSIONS.STUDENTS_UPDATE, id);
    return this.studentService.setPhoto(id, requireFile(file));
  }

  @Get(':id/status-history')
  @RequirePermissions(PERMISSIONS.STUDENTS_READ)
  @ResponseMessage('Status history')
  async statusHistory(@Param('id', ParseUUIDPipe) id: string) {
    await this.scope.assert(PERMISSIONS.STUDENTS_READ, id);
    return this.studentService.statusHistory(id);
  }

  /** A one-time password for the student's portal login (printed slip). */
  @Post(':id/portal-slip')
  @RequirePermissions(PERMISSIONS.STUDENTS_UPDATE)
  @ResponseMessage('Portal password issued')
  async portalSlip(@Param('id', ParseUUIDPipe) id: string) {
    await this.scope.assert(PERMISSIONS.STUDENTS_UPDATE, id);
    return this.studentService.portalSlip(id);
  }
}
