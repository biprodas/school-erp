import { IsDefined, IsEmail, IsNotEmpty } from 'class-validator';

export class ResendVerificationDto {
  @IsDefined()
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
