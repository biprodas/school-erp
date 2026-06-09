import { IsDefined, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @IsDefined()
  @IsString()
  @MinLength(6)
  newPassword: string;
}
