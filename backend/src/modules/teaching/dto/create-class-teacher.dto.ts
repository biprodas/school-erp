import { IsBoolean, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateClassTeacherDto {
  @IsUUID('4')
  @IsNotEmpty()
  classId: string;

  @IsUUID('4')
  @IsNotEmpty()
  sectionId: string;

  @IsUUID('4')
  @IsNotEmpty()
  employeeId: string;

  @IsUUID('4')
  @IsNotEmpty()
  academicYearId: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
