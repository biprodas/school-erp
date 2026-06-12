import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateClassSectionDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  capacity?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
