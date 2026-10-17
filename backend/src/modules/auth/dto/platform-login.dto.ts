import { IsDefined, IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class PlatformLoginDto {
  @IsEmail()
  @IsNotEmpty()
  @IsDefined()
  email: string;

  @IsString()
  @IsNotEmpty()
  @IsDefined()
  password: string;
}
