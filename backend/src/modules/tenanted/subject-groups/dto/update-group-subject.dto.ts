import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateGroupSubjectDto {
  @IsOptional()
  @IsBoolean()
  isCompulsory?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}
