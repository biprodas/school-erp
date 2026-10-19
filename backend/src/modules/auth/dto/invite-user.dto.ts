import {
  IsArray,
  IsDefined,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { IsPhone } from '~/common/identity/is-phone.decorator';

export class InviteUserDto {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name: string;

  /** With an email, the user gets an activation link to set a password. */
  @ValidateIf((o: InviteUserDto) => o.phone === undefined)
  @IsEmail()
  email?: string;

  /** Phone-only invites get a temporary password for a printed slip. */
  @IsOptional()
  @IsPhone()
  phone?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  roleIds?: string[];
}
