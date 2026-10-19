import { IsDefined, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RefreshTokenDto {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  refreshToken: string;
}
