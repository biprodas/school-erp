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
  ValidateIf,
} from 'class-validator';
import { IsPhone } from '~/common/identity/is-phone.decorator';
import { MembershipStatus } from '~/modules/memberships/enums/membership-status.enum';

/**
 * Adds a user with a password chosen by the admin. That password is
 * temporary: the user must change it at first sign-in. Prefer
 * `POST /users/invite`, which lets the user set their own.
 */
export class CreateOrgUserDto {
  @IsString()
  @IsNotEmpty()
  @IsDefined()
  name: string;

  /** Email or phone (or both) identifies the account. */
  @ValidateIf((o: CreateOrgUserDto) => o.phone === undefined)
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsPhone()
  phone?: string;

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
