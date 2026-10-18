import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { StakeholderStatus } from '../enums/stakeholder-status.enum';
import { StakeholderType } from '../enums/stakeholder-type.enum';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';

export class FilterStakeholderDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @IsOptional()
  @IsEnum(StakeholderType)
  type?: StakeholderType;

  @IsOptional()
  @IsEnum(StakeholderStatus)
  status?: StakeholderStatus;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  organization?: string;

  @IsOptional()
  @IsUUID('4')
  userId?: string;
}
