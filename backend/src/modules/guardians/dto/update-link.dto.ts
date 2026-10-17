import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { GuardianRelation } from '../enums/guardian-relation.enum';

export class UpdateLinkDto {
  @IsOptional()
  @IsEnum(GuardianRelation)
  relation?: GuardianRelation;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsBoolean()
  isEmergency?: boolean;
}
