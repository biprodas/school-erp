import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsNotEmpty, IsString } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ description: 'Raw verification token from the emailed link' })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  token: string;
}
