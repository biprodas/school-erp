import { IsDateString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreatePromotionDto {
  @IsUUID('4')
  @IsNotEmpty()
  studentId: string;

  @IsUUID('4')
  @IsNotEmpty()
  fromYearId: string;

  @IsUUID('4')
  @IsNotEmpty()
  toYearId: string;

  @IsUUID('4')
  @IsNotEmpty()
  fromClassId: string;

  @IsUUID('4')
  @IsNotEmpty()
  toClassId: string;

  @IsOptional()
  @IsUUID('4')
  fromSectionId?: string;

  @IsOptional()
  @IsUUID('4')
  toSectionId?: string;

  @IsOptional()
  @IsDateString()
  promotionDate?: string;
}
