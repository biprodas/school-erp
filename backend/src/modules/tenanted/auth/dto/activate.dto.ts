import { IsDefined, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ActivateDto {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsDefined()
  @IsString()
  @MinLength(6)
  password: string;
}
