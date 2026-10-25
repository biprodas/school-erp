import {
  IsDefined,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { PlatformRole } from '../enums/platform-role.enum';
import { UserStatus } from '../enums/user-status.enum';

export class CreateUserDto {
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

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  /** What they may do in the platform console; `user` (none) by default. */
  @IsOptional()
  @IsEnum(PlatformRole)
  platformRole?: PlatformRole;
}
