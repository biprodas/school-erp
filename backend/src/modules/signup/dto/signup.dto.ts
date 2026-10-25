import {
  IsDefined,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { IsPhone } from '~/common/identity/is-phone.decorator';
import { IsSlug } from '~/shared/slug/reserved-slugs';
import { OrganizationType } from '~/modules/organizations/enums/organization-type.enum';

export class StartSignupDto {
  @IsDefined()
  @IsString()
  @Length(3, 100)
  schoolName: string;

  /**
   * Optional: the web signup leaves it to onboarding's profile step.
   * Defaults to `school`.
   */
  @IsOptional()
  @IsEnum(OrganizationType)
  type?: OrganizationType;

  @IsDefined()
  @IsString()
  @IsSlug()
  slug: string;

  @IsDefined()
  @IsString()
  @Length(2, 100)
  ownerName: string;

  @IsDefined()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsOptional()
  @IsPhone()
  phone?: string;

  /** Required unless `googleTicket` verifies the email. */
  @ValidateIf((dto: StartSignupDto) => !dto.googleTicket)
  @IsDefined()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;

  /**
   * From Google sign-in with `intent=signup`: Google verified this email,
   * so the school is created at once instead of emailing a link.
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  googleTicket?: string;
}

export class VerifySignupDto {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  token: string;

  /** A new address when the requested one was taken in the meantime. */
  @IsOptional()
  @IsString()
  @IsSlug()
  slug?: string;
}
