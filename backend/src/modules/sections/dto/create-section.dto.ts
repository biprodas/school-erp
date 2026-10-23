import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSectionDto {
  @IsUUID('4')
  @IsNotEmpty()
  academicYearId: string;

  @IsUUID('4')
  @IsNotEmpty()
  classId: string;

  /** Unique within the class and session. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name: string;

  @IsOptional()
  @IsUUID('4')
  shiftId?: string | null;

  @IsOptional()
  @IsUUID('4')
  roomId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  capacity?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
