import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateDesignationDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
