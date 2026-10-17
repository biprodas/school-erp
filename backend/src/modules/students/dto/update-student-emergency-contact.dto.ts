import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateStudentEmergencyContactDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  relation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  alternatePhone?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  priority?: number;
}
