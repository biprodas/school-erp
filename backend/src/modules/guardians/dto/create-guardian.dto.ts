import { Type } from 'class-transformer';
import {
  IsDefined,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateGuardianUserDto {
  @IsEmail()
  @IsNotEmpty()
  @IsDefined()
  email: string;

  @IsString()
  @MinLength(6)
  @IsDefined()
  password: string;
}

export class CreateGuardianDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  /** Attach an existing tenant user as the guardian's login account. */
  @IsOptional()
  @IsUUID('4')
  userId?: string;

  /** Provision a new tenant user (with the 'guardian' role) and link it. */
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateGuardianUserDto)
  createUser?: CreateGuardianUserDto;
}
