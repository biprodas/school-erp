import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class SendWelcomeEmailDto {
  @ApiProperty({
    example: 'someone@example.com',
    description: 'Recipient address',
  })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Jane Doe', description: 'Name shown in the email' })
  @IsString()
  @IsNotEmpty()
  name: string;
}
