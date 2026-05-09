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
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @IsDefined()
  lastName: string;

  @IsEmail()
  @IsNotEmpty()
  @IsDefined()
  email: string;

  @IsString()
  @MinLength(6)
  @IsDefined()
  password: string;

  @IsOptional()
  @IsEnum(PlatformRole)
  role?: PlatformRole;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
