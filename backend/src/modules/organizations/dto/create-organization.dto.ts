import {
  IsString,
  IsNotEmpty,
  Length,
  IsOptional,
  IsDefined,
  IsUUID,
  IsEnum,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { IsSlug } from '~/shared/slug/reserved-slugs';
import { PlanCode } from '~/modules/plans/plans.catalog';
import { OrganizationType } from '../enums/organization-type.enum';

export class CreateOrganizationDto {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @Length(3, 100)
  name: string;

  @IsDefined()
  @IsString()
  @IsSlug()
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

  /** Defaults to `free`. */
  @IsOptional()
  @IsEnum(PlanCode)
  planCode?: PlanCode;

  /**
   * Starts the school on a trial of this many days (status `trial`, the
   * trial plan's features); without it the school is `active` on its plan.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  trialDays?: number;
}
