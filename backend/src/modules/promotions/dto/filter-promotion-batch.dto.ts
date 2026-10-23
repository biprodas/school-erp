import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { PromotionBatchStatus } from '../enums/promotion.enum';

export class FilterPromotionBatchDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4')
  fromYearId?: string;

  @IsOptional()
  @IsUUID('4')
  classId?: string;

  @IsOptional()
  @IsEnum(PromotionBatchStatus)
  status?: PromotionBatchStatus;
}
