import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'someone@example.com' })
  @IsDefined()
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
