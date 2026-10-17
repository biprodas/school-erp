import { IsOptional, IsUUID } from 'class-validator';

export class FilterPromotionDto {
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @IsOptional()
  @IsUUID('4')
  studentId?: string;

  @IsOptional()
  @IsUUID('4')
  fromYearId?: string;

  @IsOptional()
  @IsUUID('4')
  toYearId?: string;
}
