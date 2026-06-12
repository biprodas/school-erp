import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateClassSubjectGroupDto {
  @IsUUID('4')
  @IsNotEmpty()
  classId: string;

  @IsUUID('4')
  @IsNotEmpty()
  subjectGroupId: string;

  @IsUUID('4')
  @IsNotEmpty()
  academicYearId: string;
}
