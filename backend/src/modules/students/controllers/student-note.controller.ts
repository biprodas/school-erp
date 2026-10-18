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
  constructor(private readonly noteService: StudentNoteService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.STUDENT_NOTES_READ)
  @ResponseMessage('Notes')
  list(@Param('studentId', ParseUUIDPipe) studentId: string) {
    return this.noteService.listForStudent(studentId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.STUDENT_NOTES_CREATE)
  @ResponseMessage('Note added')
  create(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body() dto: CreateStudentNoteDto,
    @CurrentUser() user: { userId?: string } | undefined,
  ) {
    return this.noteService.create(studentId, dto, user?.userId ?? null);
  }

  @Patch(':noteId')
  @RequirePermissions(PERMISSIONS.STUDENT_NOTES_UPDATE)
  @ResponseMessage('Note updated')
  update(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Body() dto: UpdateStudentNoteDto,
  ) {
    return this.noteService.update(studentId, noteId, dto);
  }

  @Delete(':noteId')
  @RequirePermissions(PERMISSIONS.STUDENT_NOTES_DELETE)
  @ResponseMessage('Note removed')
  async remove(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
  ) {
    await this.noteService.remove(studentId, noteId);
  }
}
