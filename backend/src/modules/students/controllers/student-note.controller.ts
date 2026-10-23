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
import { StudentScope } from '../services/student-scope.service';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { CreateStudentNoteDto } from '../dto/create-student-note.dto';
import { UpdateStudentNoteDto } from '../dto/update-student-note.dto';
import { StudentNoteService } from '../services/student-note.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

@ApiTags('Tenant / Students')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('students/:studentId/notes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StudentNoteController {
  constructor(
    private readonly noteService: StudentNoteService,
    private readonly scope: StudentScope,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.STUDENT_NOTES_READ)
  @ResponseMessage('Notes')
  async list(@Param('studentId', ParseUUIDPipe) studentId: string) {
    await this.scope.assert(PERMISSIONS.STUDENT_NOTES_READ, studentId);
    return this.noteService.listForStudent(studentId, await this.sensitive());
  }

  @Post()
  @RequirePermissions(PERMISSIONS.STUDENT_NOTES_CREATE)
  @ResponseMessage('Note added')
  async create(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body() dto: CreateStudentNoteDto,
  ) {
    await this.scope.assert(PERMISSIONS.STUDENT_NOTES_CREATE, studentId);
    return this.noteService.create(studentId, dto, await this.sensitive());
  }

  @Patch(':noteId')
  @RequirePermissions(PERMISSIONS.STUDENT_NOTES_UPDATE)
  @ResponseMessage('Note updated')
  async update(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Body() dto: UpdateStudentNoteDto,
  ) {
    await this.scope.assert(PERMISSIONS.STUDENT_NOTES_UPDATE, studentId);
    return this.noteService.update(
      studentId,
      noteId,
      dto,
      await this.sensitive(),
    );
  }

  @Delete(':noteId')
  @RequirePermissions(PERMISSIONS.STUDENT_NOTES_DELETE)
  @ResponseMessage('Note removed')
  async remove(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
  ) {
    await this.scope.assert(PERMISSIONS.STUDENT_NOTES_DELETE, studentId);
    await this.noteService.remove(studentId, noteId, await this.sensitive());
  }

  /** Whether the caller reaches health, disciplinary and counselling notes. */
  private sensitive(): Promise<boolean> {
    return this.scope.can(PERMISSIONS.STUDENT_NOTES_READ_SENSITIVE);
  }
}
