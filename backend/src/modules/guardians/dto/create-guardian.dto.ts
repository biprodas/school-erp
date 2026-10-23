import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { IsPhone } from '~/common/identity/is-phone.decorator';

/**
 * A guardian needs an email or a phone: it becomes their portal login. A
 * phone already used by a guardian of this school is refused (409); link
 * that guardian instead.
 */
export class CreateGuardianDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  nameBn?: string;

  @ValidateIf((o: CreateGuardianDto) => o.email === undefined)
  @IsPhone()
  phone?: string;

  @ValidateIf((o: CreateGuardianDto) => o.phone === undefined)
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  occupation?: string;

  /** Monthly income in minor units (poisha). */
  @IsOptional()
  @IsInt()
  @Min(0)
  income?: number;

  /** Bangladesh NID: 10, 13 or 17 digits. Stored encrypted. */
  @IsOptional()
  @Matches(/^(\d{10}|\d{13}|\d{17})$/, {
    message: 'nid must be 10, 13 or 17 digits',
  })
  nid?: string;
}
