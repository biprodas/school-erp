import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { LOCALES, type Locale } from '~/shared/locale/locales';

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

  @ApiPropertyOptional({
    enum: LOCALES,
    description: "Language of the email (default: the request's, else en)",
  })
  @IsOptional()
  @IsIn(LOCALES)
  locale?: Locale;
}
