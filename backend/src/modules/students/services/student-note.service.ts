import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '~/modules/audit/services/audit.service';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';
import { RequestContext } from '~/shared/request-context/request-context.service';
import { CreateStudentNoteDto } from '../dto/create-student-note.dto';
import { UpdateStudentNoteDto } from '../dto/update-student-note.dto';
import { StudentNote } from '../entities/student-note.entity';
import { NoteType, SENSITIVE_NOTE_TYPES } from '../enums/note-type.enum';
import { StudentNoteRepository } from '../repositories/student-note.repository';
import { StudentService } from './student.service';

const isSensitive = (type: NoteType) => SENSITIVE_NOTE_TYPES.includes(type);

/**
 * Notes on a student (PRD 6.6). Health, disciplinary and counselling notes
 * need `student_notes:read_sensitive` to read, write or even see that they
 * exist (`sensitive` below); reading them is audited without their text.
 */
@Injectable()
export class StudentNoteService {
  constructor(
    private readonly noteRepo: StudentNoteRepository,
    private readonly studentService: StudentService,
    private readonly audit: AuditService,
    private readonly context: RequestContext,
  ) {}

  async listForStudent(
    studentId: string,
    sensitive: boolean,
  ): Promise<StudentNote[]> {
    await this.studentService.findById(studentId);
    const notes = await this.noteRepo.findByStudent(studentId, sensitive);
    if (notes.some((n) => isSensitive(n.noteType))) {
      await this.audit.record({
        action: AUDIT_ACTIONS.STUDENT_NOTE_SENSITIVE_VIEWED,
        entityType: 'student',
        entityId: studentId,
      });
    }
    return notes;
  }

  async create(
    studentId: string,
    dto: CreateStudentNoteDto,
    sensitive: boolean,
  ): Promise<StudentNote> {
    await this.studentService.findById(studentId);
    const noteType = dto.noteType ?? NoteType.GENERAL;
    assertMay(noteType, sensitive);
    return this.noteRepo.saveNew({
      studentId,
      noteType,
      note: dto.note,
      createdBy: this.context.current().userId,
    });
  }

  async update(
    studentId: string,
    noteId: string,
    dto: UpdateStudentNoteDto,
    sensitive: boolean,
  ): Promise<StudentNote> {
    const note = await this.getOrFail(studentId, noteId, sensitive);
    if (dto.noteType) assertMay(dto.noteType, sensitive);
    Object.assign(note, dto);
    return this.noteRepo.save(note);
  }

  async remove(
    studentId: string,
    noteId: string,
    sensitive: boolean,
  ): Promise<void> {
    await this.getOrFail(studentId, noteId, sensitive);
    await this.noteRepo.deleteById(noteId);
  }

  /** Notes the caller may see, for the 360 view. */
  countVisible(studentId: string, sensitive: boolean): Promise<number> {
    return this.noteRepo
      .findByStudent(studentId, sensitive)
      .then((notes) => notes.length);
  }

  private async getOrFail(
    studentId: string,
    noteId: string,
    sensitive: boolean,
  ): Promise<StudentNote> {
    const note = await this.noteRepo.findOneForStudent(
      studentId,
      noteId,
      sensitive,
    );
    if (!note) {
      throw new NotFoundException(
        `Note "${noteId}" not found for student "${studentId}"`,
      );
    }
    return note;
  }
}

function assertMay(type: NoteType, sensitive: boolean): void {
  if (isSensitive(type) && !sensitive) {
    throw new ForbiddenException({
      message: `${type} notes need the sensitive-notes permission`,
      code: 'SENSITIVE_NOTE_FORBIDDEN',
    });
  }
}
