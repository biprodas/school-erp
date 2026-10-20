import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { OrganizationType } from '~/modules/organizations/enums/organization-type.enum';
import { OmitOrValidate } from './settings-validators';

/**
 * `PATCH /settings/organization`: the school's own fields on
 * `organizations`. Slug, status, plan and trial are platform decisions and
 * have their own flows.
 */
export class UpdateOrganizationSettingsDto {
  @OmitOrValidate() @IsString() @Length(3, 100) name?: string;
  @OmitOrValidate() @IsEnum(OrganizationType) type?: OrganizationType;

  /** Bangladesh EIIN (institution id), digits only; null clears it. */
  @IsOptional() @Matches(/^\d{4,10}$/) eiin?: string | null;

  /** Show the school in the public "Find your school" directory. */
  @OmitOrValidate() @IsBoolean() listedInDirectory?: boolean;
}
