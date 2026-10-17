import {
  IsArray,
  IsDefined,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { MembershipStatus } from '~/modules/memberships/enums/membership-status.enum';

export class CreateOrgUserDto {
  @IsString()
  @IsNotEmpty()
  @IsDefined()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  @IsDefined()
  email: string;

  @IsString()
  @MinLength(6)
  @IsDefined()
  password: string;

  /** Roles to assign to the new user. */
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  roleIds?: string[];

  @IsEnum(MembershipStatus)
  @IsOptional()
  status?: MembershipStatus;
}
