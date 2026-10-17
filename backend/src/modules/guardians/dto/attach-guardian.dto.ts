import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { GuardianRelation } from '../enums/guardian-relation.enum';
import { CreateGuardianDto } from './create-guardian.dto';

export class AttachGuardianDto {
  /** Link an existing guardian by id. */
  @IsOptional()
  @IsUUID('4')
  guardianId?: string;

  /** Or create a new guardian inline and link it. */
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateGuardianDto)
  createGuardian?: CreateGuardianDto;

  @IsEnum(GuardianRelation)
  relation: GuardianRelation;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsBoolean()
  isEmergency?: boolean;
}
