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
import { CreateStudentNoteDto } from '../dto/create-student-note.dto';
import { UpdateStudentNoteDto } from '../dto/update-student-note.dto';
import { StudentNoteService } from '../services/student-note.service';

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
  async list(@Param('studentId', ParseUUIDPipe) studentId: string) {
    const notes = await this.noteService.listForStudent(studentId);
    return {
      success: true,
      statusCode: 200,
      message: `Notes of student ${studentId}`,
      data: notes,
    };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.STUDENT_NOTES_CREATE)
  async create(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body() dto: CreateStudentNoteDto,
    @CurrentUser() user: { userId?: string } | undefined,
  ) {
    const note = await this.noteService.create(
      studentId,
      dto,
      user?.userId ?? null,
    );
    return {
      success: true,
      statusCode: 201,
      message: `Note added to student ${studentId}. ID: ${note.id}`,
      data: note,
    };
  }

  @Patch(':noteId')
  @RequirePermissions(PERMISSIONS.STUDENT_NOTES_UPDATE)
  async update(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Body() dto: UpdateStudentNoteDto,
  ) {
    const note = await this.noteService.update(studentId, noteId, dto);
    return {
      success: true,
      statusCode: 200,
      message: `Note updated. ID: ${note.id}`,
      data: note,
    };
  }

  @Delete(':noteId')
  @RequirePermissions(PERMISSIONS.STUDENT_NOTES_DELETE)
  async remove(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
  ) {
    await this.noteService.remove(studentId, noteId);
    return {
      success: true,
      statusCode: 200,
      message: `Note removed. ID: ${noteId}`,
    };
  }
}
