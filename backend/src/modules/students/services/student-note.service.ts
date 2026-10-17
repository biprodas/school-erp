import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateStudentNoteDto } from '../dto/create-student-note.dto';
import { UpdateStudentNoteDto } from '../dto/update-student-note.dto';
import { StudentNote } from '../entities/student-note.entity';
import { NoteType } from '../enums/note-type.enum';
import { StudentNoteRepository } from '../repositories/student-note.repository';
import { StudentService } from './student.service';

@Injectable()
export class StudentNoteService {
  constructor(
    private readonly noteRepo: StudentNoteRepository,
    private readonly studentService: StudentService,
  ) {}

  async listForStudent(studentId: string): Promise<StudentNote[]> {
    await this.studentService.findById(studentId);
    return this.noteRepo.findByStudent(studentId);
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
