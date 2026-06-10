import { IsDefined, IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
  @IsDefined()
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
