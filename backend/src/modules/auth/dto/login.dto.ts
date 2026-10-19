import {
  IsDefined,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

/** "Email or phone + password", shared by both realms. */
export class LoginDto {
  /** Email address or phone number (`01712345678`, `+8801712345678`). */
  @ValidateIf((o: LoginDto) => o.email === undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  identifier?: string;

  /** @deprecated Use `identifier`; kept until the frontend switches. */
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  password: string;
}

export const loginIdentifier = (dto: LoginDto): string =>
  dto.identifier ?? dto.email!;
