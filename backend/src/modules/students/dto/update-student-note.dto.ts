import { PartialType } from '@nestjs/swagger';
import { CreateStudentNoteDto } from './create-student-note.dto';

export class UpdateStudentNoteDto extends PartialType(CreateStudentNoteDto) {}
