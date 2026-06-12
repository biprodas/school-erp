import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateClassTeacherDto {
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
