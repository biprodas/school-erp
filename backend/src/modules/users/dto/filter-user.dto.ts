import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PlatformRole } from '../enums/platform-role.enum';

export class FilterUserDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  /** E.g. `support`, to list one kind of platform staff. */
  @IsOptional()
  @IsEnum(PlatformRole)
  platformRole?: PlatformRole;
}
