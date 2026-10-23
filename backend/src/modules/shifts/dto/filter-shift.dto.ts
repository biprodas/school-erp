import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';

export class FilterShiftDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;
}
