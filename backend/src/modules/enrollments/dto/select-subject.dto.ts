import { IsNotEmpty, IsUUID } from 'class-validator';

export class SelectSubjectDto {
  @IsUUID('4')
  @IsNotEmpty()
  subjectId: string;
}
