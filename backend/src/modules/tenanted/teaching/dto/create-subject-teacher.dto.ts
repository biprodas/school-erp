import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateSubjectTeacherDto {
  @IsUUID('4')
  @IsNotEmpty()
  classId: string;

  @IsUUID('4')
  @IsNotEmpty()
  sectionId: string;

  @IsUUID('4')
  @IsNotEmpty()
  subjectId: string;

  @IsUUID('4')
  @IsNotEmpty()
  employeeId: string;

  @IsUUID('4')
  @IsNotEmpty()
  academicYearId: string;
}
