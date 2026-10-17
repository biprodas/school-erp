import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateClassSubjectDto {
  @IsOptional()
  @IsBoolean()
  isCompulsory?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  weeklyClasses?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  passMarks?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  fullMarks?: number;
}
