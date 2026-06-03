import {
  IsEmail,
  IsString,
  IsNotEmpty,
  MinLength,
  IsDefined,
} from 'class-validator';

export class RegisterDto {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsDefined()
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
