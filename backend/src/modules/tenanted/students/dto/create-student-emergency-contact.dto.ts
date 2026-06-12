import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateStudentEmergencyContactDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  relation?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  phone: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  alternatePhone?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  priority?: number;
}
