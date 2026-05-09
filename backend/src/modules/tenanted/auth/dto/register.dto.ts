import { IsEmail, IsString, IsNotEmpty, MinLength, IsDefined } from 'class-validator';

export class RegisterDto {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsDefined()
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
