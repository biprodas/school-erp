import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '~/modules/audit/services/audit.service';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';
import { CreateStudentNoteDto } from '../dto/create-student-note.dto';
import { UpdateStudentNoteDto } from '../dto/update-student-note.dto';
import { StudentNote } from '../entities/student-note.entity';
import { NoteType } from '../enums/note-type.enum';
import { StudentNoteRepository } from '../repositories/student-note.repository';
import { StudentService } from './student.service';

/** Note types that hold sensitive data (health, PRD 8.1), audited on read. */
const SENSITIVE_NOTE_TYPES: ReadonlySet<NoteType> = new Set([NoteType.HEALTH]);

@Injectable()
export class StudentNoteService {
  constructor(
    private readonly noteRepo: StudentNoteRepository,
    private readonly studentService: StudentService,
    private readonly audit: AuditService,
  ) {}

  /**
   * The student's notes. When they include sensitive ones (health), the
   * read is audited (PRD 6.3) under the student, never
   * the notes themselves.
   */
  async listForStudent(studentId: string): Promise<StudentNote[]> {
    await this.studentService.findById(studentId);
    const notes = await this.noteRepo.findByStudent(studentId);
    if (notes.some((n) => SENSITIVE_NOTE_TYPES.has(n.noteType))) {
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
    createdBy: string | null,
  ): Promise<StudentNote> {
    await this.studentService.findById(studentId);

    return this.noteRepo.saveNew({
      studentId,
      noteType: dto.noteType ?? NoteType.GENERAL,
      note: dto.note,
      createdBy,
    });
  }

  async update(
    studentId: string,
    noteId: string,
    dto: UpdateStudentNoteDto,
  ): Promise<StudentNote> {
    const note = await this.getOrFail(studentId, noteId);
    Object.assign(note, dto);
    return this.noteRepo.save(note);
  }

  async remove(studentId: string, noteId: string): Promise<void> {
    await this.getOrFail(studentId, noteId);
    await this.noteRepo.deleteById(noteId);
  }

  private async getOrFail(
    studentId: string,
    noteId: string,
  ): Promise<StudentNote> {
    const note = await this.noteRepo.findByIdOrFail(noteId);
    if (note.studentId !== studentId) {
      throw new NotFoundException(
        `Note "${noteId}" not found for student "${studentId}"`,
      );
    }
    return note;
  }
}
