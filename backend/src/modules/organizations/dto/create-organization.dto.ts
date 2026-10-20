import {
  IsString,
  IsNotEmpty,
  Length,
  Matches,
  IsOptional,
  IsDefined,
  IsUUID,
  IsEnum,
} from 'class-validator';
import { OrganizationType } from '../enums/organization-type.enum';

export class CreateOrganizationDto {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @Length(3, 100)
  name: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @Length(3, 63)
  @Matches(/^[a-z0-9_]+$/, {
    message:
      'Slug must contain only lowercase letters, numbers, and underscores',
  })
  slug: string;

  /**
   * Only honored when the caller is an admin. If provided, an OWNER
   * membership is created for this user atomically with the organization.
   */
  @IsOptional()
  @IsUUID('4')
  ownerUserId?: string;

  /** Defaults to `school`. */
  @IsOptional()
  @IsEnum(OrganizationType)
  type?: OrganizationType;
}
