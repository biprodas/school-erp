import { Type } from 'class-transformer';
import {
  IsDefined,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { StakeholderStatus } from '../enums/stakeholder-status.enum';
import { StakeholderType } from '../enums/stakeholder-type.enum';

export class CreateStakeholderUserDto {
  @IsEmail()
  @IsNotEmpty()
  @IsDefined()
  email: string;

  @IsString()
  @MinLength(6)
  @IsDefined()
  password: string;
}

export class CreateStakeholderDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(StakeholderType)
  type: StakeholderType;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  organization?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(StakeholderStatus)
  status?: StakeholderStatus;

  /** Attach an existing tenant user as the stakeholder's login account. */
  @IsOptional()
  @IsUUID('4')
  userId?: string;

  /** Provision a new tenant user (with the 'stakeholder' role) and link it. */
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateStakeholderUserDto)
  createUser?: CreateStakeholderUserDto;
}
