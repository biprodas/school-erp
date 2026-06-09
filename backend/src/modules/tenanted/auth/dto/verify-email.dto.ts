import { IsDefined, IsNotEmpty, IsString } from 'class-validator';

export class VerifyEmailDto {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  token: string;
}
