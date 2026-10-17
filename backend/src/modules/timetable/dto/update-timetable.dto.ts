import { IsOptional, IsUUID } from 'class-validator';

export class UpdateTimetableDto {
  @IsOptional()
  @IsUUID('4')
  subjectId?: string;

  @IsOptional()
  @IsUUID('4')
  employeeId?: string;
}
