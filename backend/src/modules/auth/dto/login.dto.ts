import { IsEmail, IsString, IsNotEmpty, IsDefined } from 'class-validator';

export class LoginDto {
  @IsDefined()
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  password: string;
}
