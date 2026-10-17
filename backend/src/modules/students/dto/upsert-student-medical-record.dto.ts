import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpsertStudentMedicalRecordDto {
  @IsOptional()
  @IsString()
  @MaxLength(8)
  bloodGroup?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  heightCm?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  weightKg?: number;

  @IsOptional()
  @IsString()
  allergies?: string;

  @IsOptional()
  @IsString()
  medicalConditions?: string;

  @IsOptional()
  @IsString()
  disabilities?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  doctorName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  doctorPhone?: string;

  @IsOptional()
  @IsString()
  insuranceInfo?: string;
}
