import { IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';

export class FilterTermDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @IsOptional()
  @IsUUID('4')
  academicYearId?: string;
}
