import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';

export type TestEmailType = 'activation' | 'password-reset';

export class SendTestEmailDto {
  @ApiProperty({ example: 'someone@example.com', description: 'Recipient address' })
  @IsEmail()
  to: string;

  @ApiPropertyOptional({ example: 'Jane Doe', description: 'Name shown in the email' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    enum: ['activation', 'password-reset'],
    default: 'activation',
    description: 'Which template to send',
  })
  @IsOptional()
  @IsIn(['activation', 'password-reset'])
  type?: TestEmailType;
}
