import { IsEnum, IsOptional, IsString } from 'class-validator';
import { NoteType } from '../enums/note-type.enum';

export class UpdateStudentNoteDto {
  @IsOptional()
  @IsEnum(NoteType)
  noteType?: NoteType;

  @IsOptional()
  @IsString()
  note?: string;
}
