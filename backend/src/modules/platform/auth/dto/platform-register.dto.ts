import { IsDefined, IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class PlatformRegisterDto {
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
}
