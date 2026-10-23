import { IsBoolean, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class SelectSubjectDto {
  @IsUUID('4')
  @IsNotEmpty()
  subjectId: string;

  /**
   * The student's 4th subject: at most one per enrollment, and only a
   * subject the class offers as `fourth` or `optional`.
   */
  @IsOptional()
  @IsBoolean()
  isFourthSubject?: boolean;
}
