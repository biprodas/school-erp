import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { NoteType } from '../enums/note-type.enum';

export class CreateStudentNoteDto {
  @IsOptional()
  @IsEnum(NoteType)
  noteType?: NoteType;

  @IsString()
  @IsNotEmpty()
  note: string;
}
